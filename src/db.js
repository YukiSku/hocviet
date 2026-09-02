import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db;
let initPromise = null; // 二重初期化を防ぐガード

export function initDb() {
  if (initPromise) return initPromise; // 実行中/完了済みなら同じPromiseを返す

  initPromise = (async () => {
    const dbName = 'hocviet';

    const consistency = (await sqlite.checkConnectionsConsistency()).result;
    const isConn = (await sqlite.isConnection(dbName, false)).result;

    if (consistency && isConn) {
      db = await sqlite.retrieveConnection(dbName, false);
    } else {
      db = await sqlite.createConnection(dbName, false, 'no-encryption', 1, false);
    }

    await db.open();

    await db.execute(`
      CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        spelling TEXT NOT NULL,
        meaning TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS word_tags (
        word_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (word_id, tag_id),
        FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS minimal_pair_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT
      );
      CREATE TABLE IF NOT EXISTS minimal_pair_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        set_id INTEGER NOT NULL,
        spelling TEXT NOT NULL,
        meaning TEXT NOT NULL,
        FOREIGN KEY (set_id) REFERENCES minimal_pair_sets(id) ON DELETE CASCADE
      );
    `);

    return db;
  })();

  return initPromise;
}

export function getDb() {
  return db;
}

export async function addWord(spelling, meaning, tagNames = [], inTransaction = false) {
  const database = getDb();
  const result = await database.run(
    'INSERT INTO words (spelling, meaning) VALUES (?, ?)',
    [spelling, meaning],
    !inTransaction
  );
  const wordId = result.changes.lastId;

  for (const tagName of tagNames) {
    await linkTag(wordId, tagName, inTransaction);
  }
  return wordId;
}

export async function updateWord(id, spelling, meaning, tagNames = [], inTransaction = false) {
  const database = getDb();
  await database.run(
    'UPDATE words SET spelling = ?, meaning = ? WHERE id = ?',
    [spelling, meaning, id],
    !inTransaction
  );
  // タグは一旦全解除してから再登録（シンプルさ優先）
  await database.run('DELETE FROM word_tags WHERE word_id = ?', [id], !inTransaction);
  for (const tagName of tagNames) {
    await linkTag(id, tagName, inTransaction);
  }
}

export async function deleteWord(id, inTransaction = false) {
  const database = getDb();
  await database.run('DELETE FROM words WHERE id = ?', [id], !inTransaction);
}

export async function getAllWords() {
  const database = getDb();
  const wordsResult = await database.query('SELECT * FROM words ORDER BY created_at DESC');
  const words = wordsResult.values ?? [];

  // 各単語のタグを取得（件数が多くなったらJOIN一発クエリに変更検討）
  for (const word of words) {
    const tagsResult = await database.query(
      `SELECT t.name FROM tags t
       JOIN word_tags wt ON wt.tag_id = t.id
       WHERE wt.word_id = ?`,
      [word.id]
    );
    word.tags = (tagsResult.values ?? []).map((t) => t.name);
  }
  return words;
}

export async function getAllTags() {
  const database = getDb();
  const result = await database.query('SELECT name FROM tags ORDER BY name ASC');
  return (result.values ?? []).map((t) => t.name);
}

export async function getWordsByTags(tagNames) {
  if (!tagNames || tagNames.length === 0) return getAllWords();

  const database = getDb();
  const placeholders = tagNames.map(() => '?').join(',');
  const query = `
    SELECT DISTINCT w.* FROM words w
    JOIN word_tags wt ON w.id = wt.word_id
    JOIN tags t ON wt.tag_id = t.id
    WHERE t.name IN (${placeholders})
    ORDER BY w.created_at DESC
  `;
  const wordsResult = await database.query(query, tagNames);
  const words = wordsResult.values ?? [];

  for (const word of words) {
    const tagsResult = await database.query(
      `SELECT t.name FROM tags t
       JOIN word_tags wt ON wt.tag_id = t.id
       WHERE wt.word_id = ?`,
      [word.id]
    );
    word.tags = (tagsResult.values ?? []).map((t) => t.name);
  }
  return words;
}

// --- タグのヘルパー ---

async function linkTag(wordId, tagName, inTransaction = false) {
  const database = getDb();
  const trimmed = tagName.trim();
  if (!trimmed) return;

  await database.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [trimmed], !inTransaction);
  const tagResult = await database.query('SELECT id FROM tags WHERE name = ?', [trimmed]);
  const tagId = tagResult.values[0].id;

  await database.run(
    'INSERT OR IGNORE INTO word_tags (word_id, tag_id) VALUES (?, ?)',
    [wordId, tagId],
    !inTransaction
  );
}


// --- CSVインポート機能 ---
export async function importWordsFromCsv(rows) {
  const database = getDb();
  await database.beginTransaction();
  try {
    let count = 0;
    for (const row of rows) {
      const { spelling, meaning, tags } = row;
      if (!spelling || !meaning) continue;
      const tagList = tags ? tags.split(/[,、]/).map((t) => t.trim()).filter(Boolean) : [];
      await addWord(spelling, meaning, tagList, true);
      count++;
    }
    await database.commitTransaction();
    return count;
  } catch (e) {
    await database.rollbackTransaction();
    throw e;
  }
}

// --- ミニマルペア（聞き分けモード）機能 ---

/**
 * 聞き分けセットのインポート
 * CSVの set_id はグルーピング用に使用し、DB上の新しいセットIDに変換する
 */
export async function importMinimalPairsFromCsv(rows) {
  const database = getDb();
  await database.beginTransaction();
  try {
    const setsMap = new Map(); // CSV上のset_id -> DB上のsetId
    let count = 0;

    for (const row of rows) {
      const { set_id, spelling, meaning } = row;
      if (!set_id || !spelling || !meaning) continue;

      let dbSetId;
      if (setsMap.has(set_id)) {
        dbSetId = setsMap.get(set_id);
      } else {
        const result = await database.run('INSERT INTO minimal_pair_sets DEFAULT VALUES', [], false);
        dbSetId = result.changes.lastId;
        setsMap.set(set_id, dbSetId);
      }

      await database.run(
        'INSERT INTO minimal_pair_items (set_id, spelling, meaning) VALUES (?, ?, ?)',
        [dbSetId, spelling, meaning],
        false
      );
      count++;
    }
    await database.commitTransaction();
    return count;
  } catch (e) {
    await database.rollbackTransaction();
    throw e;
  }
}

/**
 * ランダムに1つのミニマルペアセットを取得する
 */
export async function getRandomMinimalPairSet() {
  const database = getDb();
  const result = await database.query('SELECT * FROM minimal_pair_sets ORDER BY RANDOM() LIMIT 1');
  return result.values && result.values.length > 0 ? result.values[0] : null;
}

/**
 * セットに紐づくアイテム一覧を取得する
 */
export async function getMinimalPairItems(setId) {
  const database = getDb();
  const result = await database.query(
    'SELECT * FROM minimal_pair_items WHERE set_id = ?',
    [setId]
  );
  return result.values ?? [];
}

// --- 正誤判定ロジック ---

/**
 * ベトナム語の声調記号を除去する
 */
export function stripToneMarks(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300\u0301\u0303\u0309\u0323]/g, '').normalize('NFC');
}

/**
 * 新旧正書法による違いを吸収する（例: hòa -> hoà）
 * 全てを「新正書法（複母音の2番目の母音に声調）」のスタイルに統一する
 */
export function normalizeVietnameseOrthography(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/o([\u0300\u0301\u0303\u0309\u0323])a/g, 'oa$1')
    .replace(/o([\u0300\u0301\u0303\u0309\u0323])e/g, 'oe$1')
    .replace(/u([\u0300\u0301\u0303\u0309\u0323])y/g, 'uy$1')
    .normalize('NFC');
}

/**
 * テキストの正規化（トリム、小文字化、正書法正規化、必要に応じて声調除去）
 */
export function normalizeText(str, options = {}) {
  const { stripTone = false } = options;
  let result = (str ?? '').trim().toLowerCase();

  // 正書法を正規化
  result = normalizeVietnameseOrthography(result);

  if (stripTone) {
    result = stripToneMarks(result);
  }
  return result;
}

/**
 * 正誤判定を行う
 * @param {string} input ユーザー入力
 * @param {string} target 正解のスペル
 * @param {string} mode 練習モード ('word' | 'sentence')
 * @returns {boolean}
 */
export function checkAnswer(input, target, mode = 'word') {
  // ターゲットが ";" または "," で区切られている場合に対応
  const targets = target.split(/[;；,，]/).map(t => t.trim()).filter(Boolean);
  const normalizedInput = normalizeText(input);

  return targets.some(t => normalizeText(t) === normalizedInput);
}

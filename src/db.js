import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

let sqlite = null;
let db = null;
let initPromise = null;

export async function initDb() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // console.log('[hocviet] DB Init: Starting...');

      // 1. インスタンス生成
      sqlite = new SQLiteConnection(CapacitorSQLite);
      const dbName = 'repeatlearn_viet';

      // 2. 接続を試行（整合性チェックは不整合時にnullを返す可能性があるため、直接openへ）
      try {
        db = await sqlite.createConnection(dbName, false, 'no-encryption', 1, false);
      } catch (e) {
        db = await sqlite.retrieveConnection(dbName, false);
      }

      await db.open();
      // console.log('[hocviet] DB Init: Success');

      await db.execute(`
        CREATE TABLE IF NOT EXISTS words (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          spelling TEXT NOT NULL,
          meaning TEXT NOT NULL,
          note TEXT,
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

      try {
        await db.execute("ALTER TABLE words ADD COLUMN note TEXT");
      } catch (e) { /* ignore */ }

      return db;
    } catch (e) {
      console.error('[hocviet] DB Init Error:', e);
      initPromise = null;
      throw e;
    }
  })();

  return initPromise;
}

export function getDb() {
  if (!db) {
    // 開発中のデバッグを容易にするため、あえて具体的な例外を投げる
    throw new Error('DATABASE_NOT_READY_CHECK_LOGCAT');
  }
  return db;
}

// 他の関数は変更なし
export async function addWord(spelling, meaning, tagNames = [], note = '', inTransaction = false) {
  if (!db) await initDb();
  const database = getDb();
  const existing = await database.query('SELECT id FROM words WHERE spelling = ?', [spelling]);
  if (existing.values && existing.values.length > 0) return null;
  const result = await database.run('INSERT INTO words (spelling, meaning, note) VALUES (?, ?, ?)', [spelling, meaning, note], !inTransaction);
  const wordId = result.changes.lastId;
  for (const tagName of tagNames) await linkTag(wordId, tagName, inTransaction);
  return wordId;
}

export async function updateWord(id, spelling, meaning, tagNames = [], note = '', inTransaction = false) {
  if (!db) await initDb();
  const database = getDb();
  await database.run('UPDATE words SET spelling = ?, meaning = ?, note = ? WHERE id = ?', [spelling, meaning, note, id], !inTransaction);
  await database.run('DELETE FROM word_tags WHERE word_id = ?', [id], !inTransaction);
  for (const tagName of tagNames) await linkTag(id, tagName, inTransaction);
}

export async function deleteWord(id, inTransaction = false) {
  if (!db) await initDb();
  const database = getDb();
  await database.run('DELETE FROM words WHERE id = ?', [id], !inTransaction);
}

export async function getAllWords() {
  if (!db) await initDb();
  const database = getDb();
  const wordsResult = await database.query('SELECT * FROM words ORDER BY created_at DESC');
  const words = wordsResult.values ?? [];
  for (const word of words) {
    const tagsResult = await database.query(`SELECT t.name FROM tags t JOIN word_tags wt ON wt.tag_id = t.id WHERE wt.word_id = ?`, [word.id]);
    word.tags = (tagsResult.values ?? []).map((t) => t.name);
  }
  return words;
}

export async function getAllTags() {
  if (!db) await initDb();
  const database = getDb();
  const result = await database.query('SELECT name FROM tags ORDER BY name ASC');
  return (result.values ?? []).map((t) => t.name);
}

export async function getWordsByTags(tagNames) {
  if (!db) await initDb();
  const database = getDb();
  if (!tagNames || tagNames.length === 0) return getAllWords();
  const placeholders = tagNames.map(() => '?').join(',');
  const query = `SELECT DISTINCT w.* FROM words w JOIN word_tags wt ON w.id = wt.word_id JOIN tags t ON wt.tag_id = t.id WHERE t.name IN (${placeholders}) ORDER BY w.created_at DESC`;
  const wordsResult = await database.query(query, tagNames);
  const words = wordsResult.values ?? [];
  for (const word of words) {
    const tagsResult = await database.query(`SELECT t.name FROM tags t JOIN word_tags wt ON wt.tag_id = t.id WHERE wt.word_id = ?`, [word.id]);
    word.tags = (tagsResult.values ?? []).map((t) => t.name);
  }
  return words;
}

async function linkTag(wordId, tagName, inTransaction = false) {
  const database = getDb();
  const trimmed = tagName.trim();
  if (!trimmed) return;
  await database.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [trimmed], !inTransaction);
  const tagResult = await database.query('SELECT id FROM tags WHERE name = ?', [trimmed]);
  const tagId = tagResult.values[0].id;
  await database.run('INSERT OR IGNORE INTO word_tags (word_id, tag_id) VALUES (?, ?)', [wordId, tagId], !inTransaction);
}

export async function importWordsFromCsv(rows) {
  if (!db) await initDb();
  const database = getDb();
  await database.beginTransaction();
  try {
    let count = 0;
    for (const row of rows) {
      // 日本語ヘッダーや引用符への対応
      const spelling = row.spelling || row['spelling'];
      const meaning = row.meaning || row['meaning'];
      const tags = row.tags || row['tags'];
      const note = row.note || row['note'] || row['例文・メモ'] || row['例文'];

      if (!spelling || !meaning) continue;
      const tagList = tags ? String(tags).split(/[,、]/).map((t) => t.trim()).filter(Boolean) : [];
      const wordId = await addWord(spelling, meaning, tagList, note || '', true);
      if (wordId) count++;
    }
    await database.commitTransaction();
    return count;
  } catch (e) {
    await database.rollbackTransaction();
    throw e;
  }
}

export async function updateWordNote(id, note) {
  if (!db) await initDb();
  const database = getDb();
  await database.run('UPDATE words SET note = ? WHERE id = ?', [note, id], true);
}

export async function importMinimalPairsFromCsv(rows) {
  if (!db) await initDb();
  const database = getDb();
  await database.beginTransaction();
  try {
    // 既存の全アイテムをチェック用に取得
    const existingResult = await database.query('SELECT spelling, set_id FROM minimal_pair_items');
    const existingItems = existingResult.values ?? [];

    const setsMap = new Map(); // CSVのset_id -> データベースのsetId
    let count = 0;

    for (const row of rows) {
      const { set_id, spelling, meaning } = row;
      if (!set_id || !spelling || !meaning) continue;

      // すでに同じ綴りがデータベースに存在するかチェック
      const isDuplicate = existingItems.some(item => item.spelling === spelling);
      if (isDuplicate) continue;

      let dbSetId;
      if (setsMap.has(set_id)) {
        dbSetId = setsMap.get(set_id);
      } else {
        const result = await database.run('INSERT INTO minimal_pair_sets DEFAULT VALUES', [], false);
        dbSetId = result.changes.lastId;
        setsMap.set(set_id, dbSetId);
      }
      await database.run('INSERT INTO minimal_pair_items (set_id, spelling, meaning) VALUES (?, ?, ?)', [dbSetId, spelling, meaning], false);
      count++;
    }
    await database.commitTransaction();
    return count;
  } catch (e) {
    await database.rollbackTransaction();
    throw e;
  }
}

export async function getRandomMinimalPairSet(excludeId = null) {
  if (!db) await initDb();
  const database = getDb();
  let query = 'SELECT * FROM minimal_pair_sets';
  let params = [];
  if (excludeId !== null) {
    const countRes = await database.query('SELECT COUNT(*) as count FROM minimal_pair_sets');
    if (countRes.values[0].count > 1) {
      query += ' WHERE id != ?';
      params.push(excludeId);
    }
  }
  query += ' ORDER BY RANDOM() LIMIT 1';
  const result = await database.query(query, params);
  return result.values && result.values.length > 0 ? result.values[0] : null;
}

export async function getMinimalPairItems(setId) {
  if (!db) await initDb();
  const database = getDb();
  const result = await database.query('SELECT * FROM minimal_pair_items WHERE set_id = ?', [setId]);
  return result.values ?? [];
}

/**
 * 全てのミニマルペアセットをアイテム付きで取得する
 */
export async function getAllMinimalPairSets() {
  if (!db) await initDb();
  const database = getDb();
  const setsResult = await database.query('SELECT * FROM minimal_pair_sets ORDER BY id DESC');
  const sets = setsResult.values ?? [];

  for (const set of sets) {
    set.items = await getMinimalPairItems(set.id);
  }
  return sets;
}

/**
 * ミニマルペアセットを新規登録する
 */
export async function addMinimalPairSet(items) {
  if (!db) await initDb();
  const database = getDb();
  await database.beginTransaction();
  try {
    const res = await database.run('INSERT INTO minimal_pair_sets DEFAULT VALUES');
    const setId = res.changes.lastId;

    for (const item of items) {
      await database.run(
        'INSERT INTO minimal_pair_items (set_id, spelling, meaning) VALUES (?, ?, ?)',
        [setId, item.spelling, item.meaning]
      );
    }
    await database.commitTransaction();
    return setId;
  } catch (e) {
    await database.rollbackTransaction();
    throw e;
  }
}

/**
 * ミニマルペアセットを更新する
 */
export async function updateMinimalPairSet(setId, items) {
  if (!db) await initDb();
  const database = getDb();
  await database.beginTransaction();
  try {
    // 既存のアイテムを削除して再登録
    await database.run('DELETE FROM minimal_pair_items WHERE set_id = ?', [setId]);

    for (const item of items) {
      await database.run(
        'INSERT INTO minimal_pair_items (set_id, spelling, meaning) VALUES (?, ?, ?)',
        [setId, item.spelling, item.meaning]
      );
    }
    await database.commitTransaction();
  } catch (e) {
    await database.rollbackTransaction();
    throw e;
  }
}

/**
 * ミニマルペアセットを削除する
 */
export async function deleteMinimalPairSet(setId) {
  if (!db) await initDb();
  const database = getDb();
  // ON DELETE CASCADE なので親を消せば子も消える
  await database.run('DELETE FROM minimal_pair_sets WHERE id = ?', [setId]);
}

export function stripToneMarks(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300\u0301\u0303\u0309\u0323]/g, '').normalize('NFC');
}

export function normalizeVietnameseOrthography(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/o([\u0300\u0301\u0303\u0309\u0323])a/g, 'oa$1').replace(/o([\u0300\u0301\u0303\u0309\u0323])e/g, 'oe$1').replace(/u([\u0300\u0301\u0303\u0309\u0323])y/g, 'uy$1').normalize('NFC');
}

export function normalizeText(str, options = {}) {
  const { stripTone = false } = options;
  let result = (str ?? '').trim().toLowerCase();
  result = normalizeVietnameseOrthography(result);
  if (stripTone) result = stripToneMarks(result);
  return result;
}

export function checkAnswer(input, target, mode = 'word') {
  const targets = target.split(/[;；,，]/).map(t => t.trim()).filter(Boolean);
  const normalizedInput = normalizeText(input);
  return targets.some(t => normalizeText(t) === normalizedInput);
}

import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

let sqlite = null;
let db = null;
let initPromise = null;

export async function initDb() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. インスタンス生成
      if (!sqlite) {
        sqlite = new SQLiteConnection(CapacitorSQLite);
      }
      const dbName = 'repeatlearn_viet';

      // 2. v8必須: 接続の整合性チェック
      await sqlite.checkConnectionsConsistency();

      // 3. 既存の接続があるか確認
      const isConn = await sqlite.isConnection(dbName, false);

      if (isConn.result) {
        // すでに接続がある場合は取得
        db = await sqlite.retrieveConnection(dbName, false);
      } else {
        // ない場合は新規作成
        db = await sqlite.createConnection(dbName, false, 'no-encryption', 1, false);
      }

      if (!db) {
        throw new Error(`Failed to obtain connection for ${dbName}`);
      }

      // 4. データベースをオープン
      await db.open();

      // 5. スキーマ作成
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
      db = null;
      throw e;
    }
  })();

  return initPromise;
}

export function getDb() {
  if (!db) {
    throw new Error('DATABASE_NOT_READY');
  }
  return db;
}

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

/**
 * 単語の総数を取得する
 */
export async function getTotalWordCount() {
  if (!db) await initDb();
  const database = getDb();
  const result = await database.query('SELECT COUNT(*) as count FROM words');
  return result.values?.[0]?.count ?? 0;
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

/**
 * 単語リストをページネーション付きで取得する（検索・フィルタ対応）
 */
export async function getWordsPaginated({ limit = 20, offset = 0, searchQuery = '', filterTag = null }) {
  if (!db) await initDb();
  const database = getDb();

  let query = '';
  let params = [];

  if (filterTag) {
    query = `
      SELECT DISTINCT w.* FROM words w
      JOIN word_tags wt ON w.id = wt.word_id
      JOIN tags t ON wt.tag_id = t.id
      WHERE t.name = ?
    `;
    params.push(filterTag);

    if (searchQuery) {
      query += ` AND (w.spelling LIKE ? OR w.meaning LIKE ? OR w.note LIKE ?)`;
      const like = `%${searchQuery}%`;
      params.push(like, like, like);
    }
  } else {
    query = `SELECT * FROM words w`;
    if (searchQuery) {
      query += ` WHERE (w.spelling LIKE ? OR w.meaning LIKE ? OR w.note LIKE ?)`;
      const like = `%${searchQuery}%`;
      params.push(like, like, like);
    }
  }

  query += ` ORDER BY w.created_at DESC, w.id DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result = await database.query(query, params);
  const words = result.values ?? [];

  for (const word of words) {
    const tagsResult = await database.query(
      `SELECT t.name FROM tags t JOIN word_tags wt ON wt.tag_id = t.id WHERE wt.word_id = ?`,
      [word.id]
    );
    word.tags = (tagsResult.values ?? []).map((t) => t.name);
  }

  return words;
}

/**
 * ランダムに単語を1件取得する（タグ指定対応）
 */
export async function getRandomWord(tagNames = []) {
  if (!db) await initDb();
  const database = getDb();

  let query = '';
  let params = [];

  if (tagNames && tagNames.length > 0) {
    const placeholders = tagNames.map(() => '?').join(',');
    query = `
      SELECT DISTINCT w.* FROM words w
      JOIN word_tags wt ON w.id = wt.word_id
      JOIN tags t ON wt.tag_id = t.id
      WHERE t.name IN (${placeholders})
      ORDER BY RANDOM() LIMIT 1
    `;
    params = tagNames;
  } else {
    query = `SELECT * FROM words ORDER BY RANDOM() LIMIT 1`;
  }

  const result = await database.query(query, params);
  const word = result.values?.[0] ?? null;

  if (word) {
    const tagsResult = await database.query(
      `SELECT t.name FROM tags t JOIN word_tags wt ON wt.tag_id = t.id WHERE wt.word_id = ?`,
      [word.id]
    );
    word.tags = (tagsResult.values ?? []).map((t) => t.name);
  }
  return word;
}

/**
 * 指定した単語以外からランダムに選択肢を取得する
 */
export async function getRandomOptions(targetId, count, tagNames = []) {
  if (!db) await initDb();
  const database = getDb();

  let query = '';
  let params = [targetId];

  if (tagNames && tagNames.length > 0) {
    const placeholders = tagNames.map(() => '?').join(',');
    query = `
      SELECT DISTINCT w.* FROM words w
      JOIN word_tags wt ON w.id = wt.word_id
      JOIN tags t ON wt.tag_id = t.id
      WHERE w.id != ? AND t.name IN (${placeholders})
      ORDER BY RANDOM() LIMIT ?
    `;
    params = [targetId, ...tagNames, count];
  } else {
    query = `SELECT * FROM words WHERE id != ? ORDER BY RANDOM() LIMIT ?`;
    params.push(count);
  }

  const result = await database.query(query, params);
  const options = result.values ?? [];

  for (const word of options) {
    const tagsResult = await database.query(
      `SELECT t.name FROM tags t JOIN word_tags wt ON wt.tag_id = t.id WHERE wt.word_id = ?`,
      [word.id]
    );
    word.tags = (tagsResult.values ?? []).map((t) => t.name);
  }
  return options;
}

async function linkTag(wordId, tagName, inTransaction = false) {
  const database = getDb();
  const trimmed = tagName.trim();
  if (!trimmed) return;
  await database.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [trimmed], !inTransaction);
  const tagResult = await database.query('SELECT id FROM tags WHERE name = ?', [trimmed]);
  if (tagResult.values && tagResult.values.length > 0) {
    const tagId = tagResult.values[0].id;
    await database.run('INSERT OR IGNORE INTO word_tags (word_id, tag_id) VALUES (?, ?)', [wordId, tagId], !inTransaction);
  }
}

export async function importWordsFromCsv(rows) {
  if (!db) await initDb();
  const database = getDb();
  await database.beginTransaction();
  try {
    let count = 0;
    for (const row of rows) {
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
    const existingResult = await database.query('SELECT spelling, set_id FROM minimal_pair_items');
    const existingItems = existingResult.values ?? [];

    const setsMap = new Map();
    let count = 0;

    for (const row of rows) {
      const { set_id, spelling, meaning } = row;
      if (!set_id || !spelling || !meaning) continue;

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

export async function addMinimalPairSet(items, inTransaction = false) {
  if (!db) await initDb();
  const database = getDb();
  if (!inTransaction) await database.beginTransaction();
  try {
    const res = await database.run('INSERT INTO minimal_pair_sets DEFAULT VALUES', [], !inTransaction);
    const setId = res.changes.lastId;

    for (const item of items) {
      await database.run(
        'INSERT INTO minimal_pair_items (set_id, spelling, meaning) VALUES (?, ?, ?)',
        [setId, item.spelling, item.meaning],
        !inTransaction
      );
    }
    if (!inTransaction) await database.commitTransaction();
    return setId;
  } catch (e) {
    if (!inTransaction) await database.rollbackTransaction();
    throw e;
  }
}

export async function updateMinimalPairSet(setId, items, inTransaction = false) {
  if (!db) await initDb();
  const database = getDb();
  if (!inTransaction) await database.beginTransaction();
  try {
    await database.run('DELETE FROM minimal_pair_items WHERE set_id = ?', [setId], !inTransaction);

    for (const item of items) {
      await database.run(
        'INSERT INTO minimal_pair_items (set_id, spelling, meaning) VALUES (?, ?, ?)',
        [setId, item.spelling, item.meaning],
        !inTransaction
      );
    }
    if (!inTransaction) await database.commitTransaction();
  } catch (e) {
    if (!inTransaction) await database.rollbackTransaction();
    throw e;
  }
}

export async function deleteMinimalPairSet(setId) {
  if (!db) await initDb();
  const database = getDb();
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

// --- バックアップ・復元用 ---

export const IMPORT_MODE = {
  SKIP: 'skip',
  OVERWRITE: 'overwrite',
  RESTORE: 'restore'
};

export async function exportFullBackup() {
  const words = await getAllWords();
  const minimalPairs = await getAllMinimalPairSets();
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    words,
    minimalPairs
  };
}

export async function importFullBackup(data, mode) {
  if (!db) await initDb();
  const database = getDb();

  await database.beginTransaction();
  try {
    if (mode === IMPORT_MODE.RESTORE) {
      await database.execute('DELETE FROM word_tags');
      await database.execute('DELETE FROM tags');
      await database.execute('DELETE FROM words');
      await database.execute('DELETE FROM minimal_pair_items');
      await database.execute('DELETE FROM minimal_pair_sets');
    }

    let wordCount = 0;
    if (data.words && Array.isArray(data.words)) {
      for (const w of data.words) {
        const existing = await database.query('SELECT id FROM words WHERE spelling = ?', [w.spelling]);
        const exists = existing.values && existing.values.length > 0;

        if (exists) {
          if (mode === IMPORT_MODE.OVERWRITE || mode === IMPORT_MODE.RESTORE) {
            const wordId = existing.values[0].id;
            await updateWord(wordId, w.spelling, w.meaning, w.tags || [], w.note || '', true);
            wordCount++;
          }
        } else {
          await addWord(w.spelling, w.meaning, w.tags || [], w.note || '', true);
          wordCount++;
        }
      }
    }

    let pairCount = 0;
    if (data.minimalPairs && Array.isArray(data.minimalPairs)) {
      for (const set of data.minimalPairs) {
        await addMinimalPairSet(set.items, true);
        pairCount++;
      }
    }

    await database.commitTransaction();
    return { wordCount, pairCount };
  } catch (e) {
    await database.rollbackTransaction();
    throw e;
  }
}

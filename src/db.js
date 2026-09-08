import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

let sqlite = null;
let db = null;
let initPromise = null;

/**
 * データベースの初期化
 */
export async function initDb() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (!sqlite) {
        sqlite = new SQLiteConnection(CapacitorSQLite);
      }
      const dbName = 'repeatlearn_viet';

      // v8必須: 接続の整合性チェック
      await sqlite.checkConnectionsConsistency();

      const isConn = await sqlite.isConnection(dbName, false);
      if (isConn.result) {
        try {
          db = await sqlite.retrieveConnection(dbName, false);
        } catch (e) {
          await sqlite.closeConnection(dbName, false);
          db = await sqlite.createConnection(dbName, false, 'no-encryption', 1, false);
        }
      } else {
        db = await sqlite.createConnection(dbName, false, 'no-encryption', 1, false);
      }

      if (!db) throw new Error(`Failed to obtain connection for ${dbName}`);

      await db.open();

      // スキーマ作成
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
  if (!db) throw new Error('DATABASE_NOT_READY');
  return db;
}

/**
 * 単語の追加
 */
export async function addWord(spelling, meaning, tagNames = [], note = '', inTransaction = false) {
  if (!db) await initDb();
  const database = getDb();

  const shouldManageTransaction = !inTransaction;
  if (shouldManageTransaction) await database.beginTransaction();

  try {
    const existing = await database.query('SELECT id FROM words WHERE spelling = ?', [spelling]);
    if (existing.values && existing.values.length > 0) {
      if (shouldManageTransaction) await database.rollbackTransaction();
      return null;
    }
    const result = await database.run('INSERT INTO words (spelling, meaning, note) VALUES (?, ?, ?)', [spelling, meaning, note], false);
    const wordId = result.changes.lastId;

    for (const tagName of tagNames) {
      await linkTag(wordId, tagName, true);
    }

    if (shouldManageTransaction) await database.commitTransaction();
    return wordId;
  } catch (e) {
    if (shouldManageTransaction) await database.rollbackTransaction();
    throw e;
  }
}

/**
 * 単語の更新
 */
export async function updateWord(id, spelling, meaning, tagNames = [], note = '', inTransaction = false) {
  if (!db) await initDb();
  const database = getDb();

  const shouldManageTransaction = !inTransaction;
  if (shouldManageTransaction) await database.beginTransaction();

  try {
    await database.run('UPDATE words SET spelling = ?, meaning = ?, note = ? WHERE id = ?', [spelling, meaning, note, id], false);
    await database.run('DELETE FROM word_tags WHERE word_id = ?', [id], false);

    for (const tagName of tagNames) {
      await linkTag(id, tagName, true);
    }

    if (shouldManageTransaction) await database.commitTransaction();
  } catch (e) {
    if (shouldManageTransaction) await database.rollbackTransaction();
    throw e;
  }
}

/**
 * 単語の削除
 */
export async function deleteWord(id, inTransaction = false) {
  if (!db) await initDb();
  const database = getDb();
  const shouldManageTransaction = !inTransaction;
  if (shouldManageTransaction) await database.beginTransaction();
  try {
    await database.run('DELETE FROM words WHERE id = ?', [id], false);
    if (shouldManageTransaction) await database.commitTransaction();
  } catch (e) {
    if (shouldManageTransaction) await database.rollbackTransaction();
    throw e;
  }
}

/**
 * 全単語の取得
 */
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

/**
 * 全タグの取得
 */
export async function getAllTags() {
  if (!db) await initDb();
  const database = getDb();
  const result = await database.query('SELECT name FROM tags ORDER BY name ASC');
  return (result.values ?? []).map((t) => t.name);
}

/**
 * 総単語数の取得
 */
export async function getTotalWordCount() {
  if (!db) await initDb();
  const database = getDb();
  const result = await database.query('SELECT COUNT(*) as count FROM words');
  return result.values?.[0]?.count ?? 0;
}

/**
 * ページネーション付き単語取得
 */
export async function getWordsPaginated({ limit = 20, offset = 0, searchQuery = '', filterTag = null }) {
  if (!db) await initDb();
  const database = getDb();

  let whereClause = '';
  let params = [];

  if (filterTag) {
    whereClause = `WHERE w.id IN (SELECT word_id FROM word_tags wt JOIN tags t ON wt.tag_id = t.id WHERE t.name = ?)`;
    params.push(filterTag);
    if (searchQuery) {
      whereClause += ` AND (w.spelling LIKE ? OR w.meaning LIKE ? OR w.note LIKE ?)`;
      const like = `%${searchQuery}%`;
      params.push(like, like, like);
    }
  } else if (searchQuery) {
    whereClause = `WHERE (w.spelling LIKE ? OR w.meaning LIKE ? OR w.note LIKE ?)`;
    const like = `%${searchQuery}%`;
    params.push(like, like, like);
  }

  const query = `
    SELECT w.*, GROUP_CONCAT(t.name) as tag_list
    FROM words w
    LEFT JOIN word_tags wt ON w.id = wt.word_id
    LEFT JOIN tags t ON wt.tag_id = t.id
    ${whereClause}
    GROUP BY w.id
    ORDER BY w.created_at DESC, w.id DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  const result = await database.query(query, params);
  const words = (result.values ?? []).map(word => ({
    ...word,
    tags: word.tag_list ? word.tag_list.split(',') : []
  }));

  return words;
}

/**
 * 単語のランダム取得 (PracticeMode用)
 */
export async function getRandomWord(tagNames = []) {
  if (!db) await initDb();
  const database = getDb();
  let whereClause = '';
  let params = [];
  if (tagNames && tagNames.length > 0) {
    const placeholders = tagNames.map(() => '?').join(',');
    whereClause = `WHERE w.id IN (SELECT word_id FROM word_tags wt JOIN tags t ON wt.tag_id = t.id WHERE t.name IN (${placeholders}))`;
    params = tagNames;
  }
  const query = `
    SELECT w.*, GROUP_CONCAT(t.name) as tag_list
    FROM words w
    LEFT JOIN word_tags wt ON w.id = wt.word_id
    LEFT JOIN tags t ON wt.tag_id = t.id
    ${whereClause}
    GROUP BY w.id
    ORDER BY RANDOM() LIMIT 1
  `;
  const result = await database.query(query, params);
  const word = result.values?.[0] ?? null;
  if (word) word.tags = word.tag_list ? word.tag_list.split(',') : [];
  return word;
}

/**
 * 選択肢のランダム取得
 */
export async function getRandomOptions(targetId, count, tagNames = []) {
  if (!db) await initDb();
  const database = getDb();
  let whereClause = 'WHERE w.id != ?';
  let params = [targetId];
  if (tagNames && tagNames.length > 0) {
    const placeholders = tagNames.map(() => '?').join(',');
    whereClause += ` AND w.id IN (SELECT word_id FROM word_tags wt JOIN tags t ON wt.tag_id = t.id WHERE t.name IN (${placeholders}))`;
    params.push(...tagNames);
  }
  const query = `
    SELECT w.*, GROUP_CONCAT(t.name) as tag_list
    FROM words w
    LEFT JOIN word_tags wt ON w.id = wt.word_id
    LEFT JOIN tags t ON wt.tag_id = t.id
    ${whereClause}
    GROUP BY w.id
    ORDER BY RANDOM() LIMIT ?
  `;
  params.push(count);
  const result = await database.query(query, params);
  return (result.values ?? []).map(word => ({
    ...word,
    tags: word.tag_list ? word.tag_list.split(',') : []
  }));
}

/**
 * タグの紐付け
 */
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

/**
 * CSVインポート (単語)
 */
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

/**
 * メモの更新
 */
export async function updateWordNote(id, note) {
  if (!db) await initDb();
  const database = getDb();
  await database.run('UPDATE words SET note = ? WHERE id = ?', [note, id], true);
}

/**
 * CSVインポート (聞き分け)
 */
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

/**
 * ランダムにセットを1件取得
 */
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

/**
 * セット内のアイテム取得 (MinimalPairMode用)
 */
export async function getMinimalPairItems(setId) {
  if (!db) await initDb();
  const database = getDb();
  const result = await database.query('SELECT * FROM minimal_pair_items WHERE set_id = ?', [setId]);
  return result.values ?? [];
}

/**
 * 全セット取得 (マスタ管理用)
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
 * セットの追加
 */
export async function addMinimalPairSet(items, inTransaction = false) {
  if (!db) await initDb();
  const database = getDb();
  const shouldManageTransaction = !inTransaction;
  if (shouldManageTransaction) await database.beginTransaction();
  try {
    const res = await database.run('INSERT INTO minimal_pair_sets DEFAULT VALUES', [], false);
    const setId = res.changes.lastId;
    for (const item of items) {
      await database.run(
        'INSERT INTO minimal_pair_items (set_id, spelling, meaning) VALUES (?, ?, ?)',
        [setId, item.spelling, item.meaning],
        false
      );
    }
    if (shouldManageTransaction) await database.commitTransaction();
    return setId;
  } catch (e) {
    if (shouldManageTransaction) await database.rollbackTransaction();
    throw e;
  }
}

/**
 * セットの更新
 */
export async function updateMinimalPairSet(setId, items, inTransaction = false) {
  if (!db) await initDb();
  const database = getDb();
  const shouldManageTransaction = !inTransaction;
  if (shouldManageTransaction) await database.beginTransaction();
  try {
    await database.run('DELETE FROM minimal_pair_items WHERE set_id = ?', [setId], false);
    for (const item of items) {
      await database.run(
        'INSERT INTO minimal_pair_items (set_id, spelling, meaning) VALUES (?, ?, ?)',
        [setId, item.spelling, item.meaning],
        false
      );
    }
    if (shouldManageTransaction) await database.commitTransaction();
  } catch (e) {
    if (shouldManageTransaction) await database.rollbackTransaction();
    throw e;
  }
}

/**
 * セットの削除
 */
export async function deleteMinimalPairSet(setId, inTransaction = false) {
  if (!db) await initDb();
  const database = getDb();
  const shouldManageTransaction = !inTransaction;
  if (shouldManageTransaction) await database.beginTransaction();
  try {
    await database.run('DELETE FROM minimal_pair_sets WHERE id = ?', [setId], false);
    if (shouldManageTransaction) await database.commitTransaction();
  } catch (e) {
    if (shouldManageTransaction) await database.rollbackTransaction();
    throw e;
  }
}

/**
 * 文字列の正規化
 */
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

// バックアップ・復元
export const IMPORT_MODE = { SKIP: 'skip', OVERWRITE: 'overwrite', RESTORE: 'restore' };

export async function exportFullBackup() {
  const words = await getAllWords();
  const minimalPairs = await getAllMinimalPairSets();
  return { version: 1, exported_at: new Date().toISOString(), words, minimalPairs };
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
        const wordId = await addWord(w.spelling, w.meaning, w.tags || [], w.note || '', true);
        if (wordId || mode !== IMPORT_MODE.SKIP) wordCount++;
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

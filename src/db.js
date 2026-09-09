import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

let sqlite = null;
let db = null;
let initPromise = null;
const DB_NAME = 'repeatlearn_viet';

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

      // v8必須: 接続の整合性チェック
      await sqlite.checkConnectionsConsistency();

      const isConn = await sqlite.isConnection(DB_NAME, false);
      if (isConn.result) {
        try {
          db = await sqlite.retrieveConnection(DB_NAME, false);
        } catch (e) {
          await sqlite.closeConnection(DB_NAME, false);
          db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
        }
      } else {
        db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
      }

      if (!db) throw new Error(`Failed to obtain connection for ${DB_NAME}`);

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
 * コネクションを強制的に破棄し、次回の initDb() で再接続させる。
 * beginTransaction/rollbackTransaction 自体が失敗した場合、ネイティブ側のSQLite接続が
 * 中途半端なトランザクション状態のまま残る可能性があるため、その接続を明示的に閉じてから
 * JS側の状態（db, initPromise）をリセットする。これにより「操作不能のまま固まる」事態を防ぐ。
 * closeConnection自体が失敗しても、db/initPromiseはリセットする（アプリを引きずったままにしない）。
 */
async function resetConnection() {
  try {
    if (sqlite) {
      await sqlite.closeConnection(DB_NAME, false);
    }
  } catch (closeError) {
    console.error('[hocviet] Failed to close broken connection during reset:', closeError);
  } finally {
    db = null;
    initPromise = null;
  }
}

/**
 * トランザクション管理とDB初期化を集約した共通ヘルパー。
 * inTransaction=true の場合は呼び出し元が既にトランザクションを開始している前提で、
 * ここでは begin/commit/rollback を行わずに fn(database) の結果だけを返す。
 * inTransaction=false の場合はこの関数自身が begin/commit/rollback を管理する。
 * begin/rollback 自体が失敗した場合は resetConnection() でコネクションを再接続可能な状態に戻す
 * （元の例外は握りつぶさず、そのまま呼び出し元に伝播させる）。
 */
async function withTransaction(inTransaction, fn) {
  if (!db) await initDb();
  const database = getDb();
  const shouldManage = !inTransaction;

  if (shouldManage) {
    try {
      await database.beginTransaction();
    } catch (beginError) {
      console.error('[hocviet] beginTransaction failed, resetting connection:', beginError);
      await resetConnection();
      throw beginError;
    }
  }

  try {
    const result = await fn(database);
    if (shouldManage) await database.commitTransaction();
    return result;
  } catch (e) {
    if (shouldManage) {
      try {
        await database.rollbackTransaction();
      } catch (rollbackError) {
        console.error('[hocviet] rollbackTransaction failed, resetting connection:', rollbackError);
        await resetConnection();
      }
    }
    throw e;
  }
}

/**
 * 単語の追加
 * 戻り値: 追加した単語のID。spellingが既に存在する場合は null（追加せず正常終了）。
 */
export async function addWord(spelling, meaning, tagNames = [], note = '', inTransaction = false) {
  return withTransaction(inTransaction, async (database) => {
    const existing = await database.query('SELECT id FROM words WHERE spelling = ?', [spelling]);
    if (existing.values && existing.values.length > 0) {
      return null;
    }
    const result = await database.run('INSERT INTO words (spelling, meaning, note) VALUES (?, ?, ?)', [spelling, meaning, note], false);
    const wordId = result.changes.lastId;

    for (const tagName of tagNames) {
      await linkTag(wordId, tagName);
    }

    return wordId;
  });
}

/**
 * 単語の更新
 */
export async function updateWord(id, spelling, meaning, tagNames = [], note = '', inTransaction = false) {
  return withTransaction(inTransaction, async (database) => {
    await database.run('UPDATE words SET spelling = ?, meaning = ?, note = ? WHERE id = ?', [spelling, meaning, note, id], false);
    await database.run('DELETE FROM word_tags WHERE word_id = ?', [id], false);

    for (const tagName of tagNames) {
      await linkTag(id, tagName);
    }
  });
}

/**
 * 単語の削除
 */
export async function deleteWord(id, inTransaction = false) {
  return withTransaction(inTransaction, (database) =>
    database.run('DELETE FROM words WHERE id = ?', [id], false)
  );
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
// 呼び出し元は addWord/updateWord のみで、常に明示的なトランザクション内から呼ばれる前提。
// そのため run() の transaction 引数は常に false（プラグイン側の自動トランザクションを無効化）で固定。
async function linkTag(wordId, tagName) {
  const database = getDb();
  const trimmed = tagName.trim();
  if (!trimmed) return;
  await database.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [trimmed], false);
  const tagResult = await database.query('SELECT id FROM tags WHERE name = ?', [trimmed]);
  if (tagResult.values && tagResult.values.length > 0) {
    const tagId = tagResult.values[0].id;
    await database.run('INSERT OR IGNORE INTO word_tags (word_id, tag_id) VALUES (?, ?)', [wordId, tagId], false);
  }
}

/**
 * CSVインポート (単語)
 */
export async function importWordsFromCsv(rows) {
  return withTransaction(false, async (database) => {
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
    return count;
  });
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
  return withTransaction(false, async (database) => {
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
    return count;
  });
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
  return withTransaction(inTransaction, async (database) => {
    const res = await database.run('INSERT INTO minimal_pair_sets DEFAULT VALUES', [], false);
    const setId = res.changes.lastId;
    for (const item of items) {
      await database.run(
        'INSERT INTO minimal_pair_items (set_id, spelling, meaning) VALUES (?, ?, ?)',
        [setId, item.spelling, item.meaning],
        false
      );
    }
    return setId;
  });
}

/**
 * セットの更新
 */
export async function updateMinimalPairSet(setId, items, inTransaction = false) {
  return withTransaction(inTransaction, async (database) => {
    await database.run('DELETE FROM minimal_pair_items WHERE set_id = ?', [setId], false);
    for (const item of items) {
      await database.run(
        'INSERT INTO minimal_pair_items (set_id, spelling, meaning) VALUES (?, ?, ?)',
        [setId, item.spelling, item.meaning],
        false
      );
    }
  });
}

/**
 * セットの削除
 */
export async function deleteMinimalPairSet(setId, inTransaction = false) {
  return withTransaction(inTransaction, (database) =>
    database.run('DELETE FROM minimal_pair_sets WHERE id = ?', [setId], false)
  );
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
  let counts;
  try {
    counts = await withTransaction(false, async (database) => {
      // RESTOREモードの場合は既存データを全削除
      if (mode === IMPORT_MODE.RESTORE) {
        await database.execute(`
          DELETE FROM word_tags;
          DELETE FROM tags;
          DELETE FROM words;
          DELETE FROM minimal_pair_items;
          DELETE FROM minimal_pair_sets;
        `, false);
      }

      // 1. 単語のインポート
      let wordCount = 0;
      if (data.words && Array.isArray(data.words)) {
        const existingWordMap = new Map();
        if (mode !== IMPORT_MODE.RESTORE) {
          const existingWords = await database.query('SELECT id, spelling FROM words');
          for (const w of existingWords.values ?? []) {
            existingWordMap.set(w.spelling, w.id);
          }
        }

        for (const w of data.words) {
          if (!w.spelling || !w.meaning) continue;
          let wordIdToUpdate = null;
          let shouldAdd = true;

          if (mode !== IMPORT_MODE.RESTORE) {
            const existingId = existingWordMap.get(w.spelling);
            if (existingId !== undefined) {
              if (mode === IMPORT_MODE.OVERWRITE) {
                wordIdToUpdate = existingId;
              } else {
                shouldAdd = false;
              }
            }
          }

          if (wordIdToUpdate) {
            await updateWord(wordIdToUpdate, w.spelling, w.meaning, w.tags || [], w.note || '', true);
            wordCount++;
          } else if (shouldAdd) {
            const wordId = await addWord(w.spelling, w.meaning, w.tags || [], w.note || '', true);
            if (wordId) {
              wordCount++;
              existingWordMap.set(w.spelling, wordId);
            }
          }
        }
      }

      // 2. 聞き分けセットのインポート
      let pairCount = 0;
      if (data.minimalPairs && Array.isArray(data.minimalPairs)) {
        const existingSets = mode === IMPORT_MODE.RESTORE ? null : await getAllMinimalPairSets();
        const existingSetKeys = existingSets ? new Set(existingSets.map(s =>
          (s.items || []).map(i => i.spelling).sort().join('|')
        )) : new Set();

        for (const set of data.minimalPairs) {
          if (!set.items || !Array.isArray(set.items)) continue;
          if (existingSets) {
            const newSetKey = set.items.map(i => i.spelling).sort().join('|');
            if (existingSetKeys.has(newSetKey)) continue;
            existingSetKeys.add(newSetKey);
          }
          const cleanItems = set.items.map(item => ({
            spelling: item.spelling,
            meaning: item.meaning
          }));
          await addMinimalPairSet(cleanItems, true);
          pairCount++;
        }
      }

      return { wordCount, pairCount };
    });
  } catch (e) {
    console.error('[hocviet] Full backup import error:', e);
    throw e;
  }

  // 整合性維持のため、どこからも参照されていないタグを掃除する（コミット成功後に確実に実行）
  try {
    const database = getDb();
    await database.execute('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM word_tags)', false);
  } catch (e) {
    console.error('[hocviet] Cleanup tags error:', e);
  }

  return counts;
}

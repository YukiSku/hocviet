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
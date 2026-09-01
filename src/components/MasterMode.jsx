import { useState, useEffect } from 'react';
import { addWord, updateWord, deleteWord, getAllWords } from '../db';

export default function MasterMode() {
  const [words, setWords] = useState([]);
  const [spelling, setSpelling] = useState('');
  const [meaning, setMeaning] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [editingId, setEditingId] = useState(null);

  async function refresh() {
    setWords(await getAllWords());
  }

  useEffect(() => { refresh(); }, []);

  function parseTags(input) {
    return input.split(',').map((t) => t.trim()).filter(Boolean);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!spelling.trim() || !meaning.trim()) return;
    const tags = parseTags(tagsInput);

    if (editingId) {
      await updateWord(editingId, spelling, meaning, tags);
    } else {
      await addWord(spelling, meaning, tags);
    }

    setSpelling(''); setMeaning(''); setTagsInput(''); setEditingId(null);
    await refresh();
  }

  function handleEdit(word) {
    setEditingId(word.id);
    setSpelling(word.spelling);
    setMeaning(word.meaning);
    setTagsInput(word.tags.join(', '));
  }

  async function handleDelete(id) {
    if (!confirm('この単語を削除しますか？')) return;
    await deleteWord(id);
    await refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4 space-y-3">
        <input
          value={spelling}
          onChange={(e) => setSpelling(e.target.value)}
          placeholder="スペル（複数可: chào; xin chào）"
          className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
        />
        <input
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder="意味（例: こんにちは）"
          className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
        />
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="タグ（カンマ区切り、例: 挨拶, 基本）"
          className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
        />
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-lg bg-blue-600 text-white py-2 font-medium">
            {editingId ? '更新する' : '登録する'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setSpelling(''); setMeaning(''); setTagsInput(''); }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4"
            >
              キャンセル
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {words.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400">まだ単語がありません</p>
        )}
        {words.map((word) => (
          <div key={word.id} className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 flex justify-between items-center">
            <div>
              <p className="font-medium">{word.spelling}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{word.meaning}</p>
              {word.tags.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {word.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full px-2 py-0.5">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => handleEdit(word)} className="text-sm text-blue-600 dark:text-blue-400">編集</button>
              <button onClick={() => handleDelete(word.id)} className="text-sm text-red-600 dark:text-red-400">削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
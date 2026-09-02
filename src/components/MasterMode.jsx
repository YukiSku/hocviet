import { useState, useEffect, useMemo } from 'react';
import { addWord, updateWord, deleteWord, getAllWords } from '../db';

export default function MasterMode() {
  const [words, setWords] = useState([]);
  const [spelling, setSpelling] = useState('');
  const [meaning, setMeaning] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [editingId, setEditingId] = useState(null);

  // 検索・フィルタ用ステート
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState(null);

  async function refresh() {
    setWords(await getAllWords());
  }

  useEffect(() => { refresh(); }, []);

  // 利用可能なすべてのタグを抽出
  const allTags = useMemo(() => {
    const tags = new Set();
    words.forEach(w => w.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [words]);

  // フィルタリングされたリスト
  const filteredWords = useMemo(() => {
    return words.filter(word => {
      const matchesSearch =
        word.spelling.toLowerCase().includes(searchQuery.toLowerCase()) ||
        word.meaning.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTag = !filterTag || word.tags.includes(filterTag);

      return matchesSearch && matchesTag;
    });
  }, [words, searchQuery, filterTag]);

  function parseTags(input) {
    return input.split(/[,、]/).map((t) => t.trim()).filter(Boolean);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!spelling.trim() || !meaning.trim()) return;
    const tags = parseTags(tagsInput);

    if (editingId) {
      await updateWord(editingId, spelling, meaning, tags);
    } else {
      const result = await addWord(spelling, meaning, tags);
      if (result === null) {
        alert('この単語は既に登録されています。');
        return;
      }
    }

    setSpelling(''); setMeaning(''); setTagsInput(''); setEditingId(null);
    await refresh();
  }

  function handleEdit(word) {
    setEditingId(word.id);
    setSpelling(word.spelling);
    setMeaning(word.meaning);
    setTagsInput(word.tags.join(', '));
    // 編集時はフォームが見えるようにスクロールトップへ
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!confirm('この単語を削除しますか？')) return;
    await deleteWord(id);
    await refresh();
  }

  return (
    <div className="space-y-4">
      {/* 固定エリア: 登録・編集フォーム + 検索・フィルタ */}
      <div className="sticky top-[56px] z-10 bg-white dark:bg-gray-900 pt-2 space-y-4 shadow-sm pb-4">
        <form onSubmit={handleSubmit} className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4 space-y-3 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-1">
             <h3 className="text-sm font-bold text-gray-500">{editingId ? '単語を編集' : '新しく登録'}</h3>
             {editingId && (
               <button
                 type="button"
                 onClick={() => { setEditingId(null); setSpelling(''); setMeaning(''); setTagsInput(''); }}
                 className="text-xs text-red-500 font-medium"
               >
                 キャンセル
               </button>
             )}
          </div>
          <input
            value={spelling}
            onChange={(e) => setSpelling(e.target.value)}
            placeholder="スペル（複数可: chào; xin chào）"
            className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="意味（例: こんにちは）"
            className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="タグ（カンマ区切り、例: 挨拶, 基本）"
            className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button type="submit" className="w-full rounded-lg bg-blue-600 text-white py-2 font-medium hover:bg-blue-700 transition">
            {editingId ? '更新する' : '登録する'}
          </button>
        </form>

        {/* 検索とフィルター */}
        <div className="px-1 space-y-3">
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="単語を検索..."
              className="w-full rounded-full border pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <span className="absolute left-3 top-2.5 text-gray-400">
              🔍
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setFilterTag(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${
                !filterTag
                  ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200'
                  : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
              }`}
            >
              すべて
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(tag === filterTag ? null : tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${
                  tag === filterTag
                    ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200'
                    : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* リストエリア */}
      <div className="space-y-2 pb-10">
        {filteredWords.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400">該当する単語が見つかりません</p>
            {(searchQuery || filterTag) && (
              <button
                onClick={() => { setSearchQuery(''); setFilterTag(null); }}
                className="text-sm text-blue-600 mt-2 underline"
              >
                検索条件をクリア
              </button>
            )}
          </div>
        )}
        {filteredWords.map((word) => (
          <div key={word.id} className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 flex justify-between items-center border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition">
            <div className="flex-1 min-w-0 pr-4">
              <p className="font-medium truncate">{word.spelling}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{word.meaning}</p>
              {word.tags.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {word.tags.map((tag) => (
                    <span key={tag} className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full px-2 py-0.5 border border-blue-100 dark:border-blue-800">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 shrink-0">
              <button onClick={() => handleEdit(word)} className="text-sm text-blue-600 dark:text-blue-400 font-medium">編集</button>
              <button onClick={() => handleDelete(word.id)} className="text-sm text-red-600 dark:text-red-400 font-medium">削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

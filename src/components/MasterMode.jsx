import { useState, useEffect, useMemo } from 'react';
import { addWord, updateWord, deleteWord, getAllWords } from '../db';
import { useTTS } from '../hooks/useTTS';

export default function MasterMode() {
  const { speak } = useTTS();
  const [words, setWords] = useState([]);
  const [spelling, setSpelling] = useState('');
  const [meaning, setMeaning] = useState('');
  const [note, setNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        word.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (word.note && word.note.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTag = !filterTag || word.tags.includes(filterTag);

      return matchesSearch && matchesTag;
    });
  }, [words, searchQuery, filterTag]);

  function parseTags(input) {
    return input.split(/[,、]/).map((t) => t.trim()).filter(Boolean);
  }

  function resetForm() {
    setSpelling('');
    setMeaning('');
    setNote('');
    setTagsInput('');
    setEditingId(null);
    setIsModalOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!spelling.trim() || !meaning.trim()) return;
    const tags = parseTags(tagsInput);

    if (editingId) {
      await updateWord(editingId, spelling, meaning, tags, note);
    } else {
      const result = await addWord(spelling, meaning, tags, note);
      if (result === null) {
        alert('この単語は既に登録されています。');
        return;
      }
    }

    resetForm();
    await refresh();
  }

  function handleEdit(word) {
    setEditingId(word.id);
    setSpelling(word.spelling);
    setMeaning(word.meaning);
    setNote(word.note || '');
    setTagsInput(word.tags.join(', '));
    setIsModalOpen(true);
  }

  async function handleDelete(id) {
    if (!confirm('この単語を削除しますか？')) return;
    await deleteWord(id);
    await refresh();
  }

  return (
    <div className="space-y-4">
      {/* 検索・フィルタエリア (Sticky) */}
      <div className="sticky top-[56px] z-10 bg-white dark:bg-gray-900 pt-2 space-y-4 shadow-sm pb-4">
        <div className="flex gap-2 px-1">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 rounded-lg bg-blue-600 text-white py-3 font-medium hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2"
          >
            <span className="text-xl">+</span>
            <span>単語を登録</span>
          </button>
        </div>

        {/* 検索とフィルター */}
        <div className="px-1 space-y-3">
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="単語やメモを検索..."
              className="w-full rounded-full border pl-10 pr-10 py-2 bg-gray-100 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <span className="absolute left-3 top-2.5 text-gray-400">
              🔍
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-1"
              >
                ✕
              </button>
            )}
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

      {/* 登録・編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-bold text-gray-700 dark:text-gray-200">
                {editingId ? '単語を編集' : '単語を新規登録'}
              </h3>
              <button
                onClick={resetForm}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">スペル *</label>
                <input
                  value={spelling}
                  onChange={(e) => setSpelling(e.target.value)}
                  placeholder="例: chào; xin chào"
                  autoFocus
                  className="w-full rounded-lg border px-3 py-2.5 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">意味 *</label>
                <input
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  placeholder="例: こんにちは"
                  className="w-full rounded-lg border px-3 py-2.5 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">タグ</label>
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="挨拶, 基本 (カンマ区切り)"
                  className="w-full rounded-lg border px-3 py-2.5 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">メモ・例文</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="補足情報や例文を入力してください"
                  rows={4}
                  className="w-full rounded-lg border px-3 py-2.5 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 rounded-lg border border-gray-300 dark:border-gray-600 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition shadow-md"
                >
                  {editingId ? '更新する' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* リストエリア */}
      <div className="space-y-2 pb-10 px-1">
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
          <div key={word.id} className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 border border-gray-100 dark:border-gray-700 hover:shadow-sm transition relative">
            <div className="flex justify-between items-start mb-1">
              <div className="min-w-0 pr-4 flex-1">
                <p className="text-lg font-bold truncate leading-tight mb-0.5">{word.spelling}</p>
                <p className="text-blue-600 dark:text-blue-400 font-medium">{word.meaning}</p>
              </div>
              <div className="flex gap-4 shrink-0 mt-1">
                <button onClick={() => handleEdit(word)} className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">編集</button>
                <button onClick={() => handleDelete(word.id)} className="text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">削除</button>
              </div>
            </div>

            {word.note && (
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700/50 p-2 rounded-lg mt-2 italic line-clamp-2">
                {word.note}
              </p>
            )}

            <div className="flex justify-between items-end mt-3 gap-2">
              <div className="flex gap-1 flex-wrap min-w-0">
                {word.tags.map((tag) => (
                  <span key={tag} className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full px-2 py-0.5 border border-blue-100 dark:border-blue-800">
                    {tag}
                  </span>
                ))}
              </div>
              <button
                onClick={() => speak(word.spelling, 0.9)}
                className="p-2.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 active:scale-90 transition shadow-sm shrink-0"
                title="音声を再生"
              >
                <span className="text-base">🔊</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


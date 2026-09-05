import { useState, useEffect, useMemo } from 'react';
import {
  addWord, updateWord, deleteWord, getAllWords,
  getAllMinimalPairSets, addMinimalPairSet, updateMinimalPairSet, deleteMinimalPairSet,
  getWordsPaginated, getAllTags
} from '../db';
import { useTTS } from '../hooks/useTTS';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';

export default function MasterMode() {
  const [subTab, setSubTab] = useState('wordList'); // 'wordList' | 'minimalPair'

  return (
    <div>
      {/* サブナビゲーション (Sticky) */}
      <div className="sticky top-[48px] z-20 bg-white dark:bg-gray-900 py-2">
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl shadow-sm">
          <button
            onClick={() => setSubTab('wordList')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              subTab === 'wordList'
                ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                : 'text-gray-500'
            }`}
          >
            単語リスト管理
          </button>
          <button
            onClick={() => setSubTab('minimalPair')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              subTab === 'minimalPair'
                ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                : 'text-gray-500'
            }`}
          >
            聞き分けセット管理
          </button>
        </div>
      </div>

      <div className="mt-4">
        {subTab === 'wordList' ? <WordListManager /> : <MinimalPairManager />}
      </div>
    </div>
  );
}

// --- 単語リスト管理コンポーネント ---

function WordListManager() {
  const { speak } = useTTS();
  const queryClient = useQueryClient();
  const [spelling, setSpelling] = useState('');
  const [meaning, setMeaning] = useState('');
  const [note, setNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState(null);

  const { ref, inView } = useInView();

  // 無限スクロール用のクエリ
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useInfiniteQuery({
    queryKey: ['words', searchQuery, filterTag],
    queryFn: ({ pageParam = 0 }) => getWordsPaginated({
      limit: 20,
      offset: pageParam,
      searchQuery,
      filterTag
    }),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length * 20 : undefined;
    },
    initialPageParam: 0,
  });

  // 全タグ取得用
  const [allTags, setAllTags] = useState([]);
  useEffect(() => {
    getAllTags().then(setAllTags);
  }, []);

  // 画面最下部に到達したら次を読み込む
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // すべてのページから単語をフラットに並べる
  const words = useMemo(() => {
    return data?.pages.flat() ?? [];
  }, [data]);

  function resetForm() {
    setSpelling(''); setMeaning(''); setNote(''); setTagsInput('');
    setEditingId(null); setIsModalOpen(false);
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['words'] });
    const t = await getAllTags();
    setAllTags(t);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!spelling.trim() || !meaning.trim()) return;
    const tags = tagsInput.split(/[,、]/).map(t => t.trim()).filter(Boolean);

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
    setEditingId(word.id); setSpelling(word.spelling); setMeaning(word.meaning);
    setNote(word.note || ''); setTagsInput(word.tags.join(', '));
    setIsModalOpen(true);
  }

  async function handleDelete(id) {
    if (!confirm('この単語を削除しますか？')) return;
    await deleteWord(id);
    await refresh();
  }

  return (
    <div className="space-y-4">
      {/* 検索・追加エリア */}
      <div className="sticky top-[108px] z-10 bg-white dark:bg-gray-900 pt-1 space-y-4 shadow-sm pb-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full rounded-xl bg-blue-600 text-white py-3 font-bold hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2"
        >
          <span>+</span><span>単語を登録</span>
        </button>

        <div className="space-y-3">
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="単語やメモを検索..."
              className="w-full rounded-full border pl-10 pr-10 py-2 bg-gray-100 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2 text-gray-400 px-1">✕</button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar text-left">
            <button
              onClick={() => setFilterTag(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                !filterTag
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:border-blue-400'
              }`}
            >
              すべて
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(tag === filterTag ? null : tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                  tag === filterTag
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:border-blue-400'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* リスト */}
      <div className="space-y-2 pb-10">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 animate-pulse text-sm">読み込み中... (Đang tải...)</p>
          </div>
        ) : words.length === 0 ? (
          <div className="text-center py-20 px-6 space-y-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <div className="text-4xl">📚</div>
            <div className="space-y-2">
              <p className="font-bold text-gray-600 dark:text-gray-300 text-lg">登録された単語がありません</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">
                自分で追加するか、<br />
                <span className="font-bold text-blue-600 dark:text-blue-400">「設定」</span>タブから<br />
                <span className="font-bold text-blue-600 dark:text-blue-400">「サンプルデータの読み込み」</span><br />
                をクリックしてください。
              </p>
            </div>
          </div>
        ) : (
          <>
            {words.map((word) => (
              <div key={word.id} className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 border border-gray-100 dark:border-gray-700 transition relative">
                <div className="flex justify-between items-start mb-1 text-left">
                  <div className="min-w-0 pr-4 flex-1">
                    <p className="text-lg font-bold truncate leading-tight mb-0.5">{word.spelling}</p>
                    <p className="text-blue-600 dark:text-blue-400 font-medium">{word.meaning}</p>
                  </div>
                  <div className="flex gap-4 shrink-0 mt-1">
                    <button onClick={() => handleEdit(word)} className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">編集</button>
                    <button onClick={() => handleDelete(word.id)} className="text-xs text-red-600 dark:text-red-400 font-bold uppercase">削除</button>
                  </div>
                </div>
                {word.note && <p className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700/50 p-2 rounded-lg mt-2 italic text-left line-clamp-2">{word.note}</p>}
                <div className="flex justify-between items-end mt-3 gap-2">
                  <div className="flex gap-1 flex-wrap min-w-0">
                    {word.tags.map(tag => <span key={tag} className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full px-2 py-0.5 border border-blue-100 dark:border-blue-800">{tag}</span>)}
                  </div>
                  <button onClick={() => speak(word.spelling, 0.9)} className="p-2.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 active:scale-90 shadow-sm shrink-0"><span className="text-base">🔊</span></button>
                </div>
              </div>
            ))}

            {/* 無限スクロールのトリガー */}
            <div ref={ref} className="py-8 flex justify-center">
              {isFetchingNextPage ? (
                <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              ) : hasNextPage ? (
                <p className="text-xs text-gray-400 uppercase tracking-widest">さらに読み込む...</p>
              ) : (
                <p className="text-xs text-gray-400 uppercase tracking-widest">すべての単語を表示しました</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-bold text-gray-700 dark:text-gray-200">{editingId ? '単語を編集' : '単語を新規登録'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">スペル *</label>
                <input value={spelling} onChange={(e) => setSpelling(e.target.value)} placeholder="例: chào; xin chào" autoFocus className="w-full rounded-lg border px-3 py-2.5 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">意味 *</label>
                <input value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="例: こんにちは" className="w-full rounded-lg border px-3 py-2.5 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">タグ</label>
                <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="挨拶, 基本" className="w-full rounded-lg border px-3 py-2.5 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">メモ・例文</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="補足情報や例文" rows={4} className="w-full rounded-lg border px-3 py-2.5 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>
              <div className="pt-2 flex gap-3 text-center">
                <button type="button" onClick={resetForm} className="flex-1 py-3 rounded-lg border border-gray-300 dark:border-gray-600 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition">キャンセル</button>
                <button type="submit" className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition shadow-md">{editingId ? '更新する' : '登録する'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 聞き分けセット管理コンポーネント ---

function MinimalPairManager() {
  const { speak } = useTTS();
  const [sets, setSets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSetId, setEditingSetId] = useState(null);

  const [formItems, setFormItems] = useState([
    { spelling: '', meaning: '' },
    { spelling: '', meaning: '' }
  ]);

  async function refresh() {
    setIsLoading(true);
    setSets(await getAllMinimalPairSets());
    setIsLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  function resetForm() {
    setFormItems([{ spelling: '', meaning: '' }, { spelling: '', meaning: '' }]);
    setEditingSetId(null);
    setIsModalOpen(false);
  }

  function addItem() {
    setFormItems([...formItems, { spelling: '', meaning: '' }]);
  }

  function removeItem(index) {
    if (formItems.length <= 2) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  }

  function updateItem(index, field, value) {
    const newItems = [...formItems];
    newItems[index][field] = value;
    setFormItems(newItems);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validItems = formItems.filter(item => item.spelling.trim() && item.meaning.trim());
    if (validItems.length < 2) {
      alert('少なくとも2つの単語（綴りと意味）を入力してください');
      return;
    }

    if (editingSetId) {
      await updateMinimalPairSet(editingSetId, validItems);
    } else {
      await addMinimalPairSet(validItems);
    }

    resetForm();
    await refresh();
  }

  function handleEdit(set) {
    setEditingSetId(set.id);
    setFormItems(set.items.map(item => ({ spelling: item.spelling, meaning: item.meaning })));
    setIsModalOpen(true);
  }

  async function handleDelete(id) {
    if (!confirm('この聞き分けセットを削除しますか？')) return;
    await deleteMinimalPairSet(id);
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-[108px] z-10 bg-white dark:bg-gray-900 pt-1 shadow-sm pb-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full rounded-xl bg-indigo-600 text-white py-3 font-bold hover:bg-indigo-700 transition shadow-md flex items-center justify-center gap-2"
        >
          <span>+</span><span>聞き分けセットを登録</span>
        </button>
      </div>

      <div className="space-y-3 pb-10">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 animate-pulse text-sm">読み込み中... (Đang tải...)</p>
          </div>
        ) : sets.length === 0 ? (
          <div className="text-center py-20 px-6 space-y-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <div className="text-4xl">🎧</div>
            <div className="space-y-2">
              <p className="font-bold text-gray-600 dark:text-gray-300 text-lg">登録されたセットがありません</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">
                自分で追加するか、<br />
                <span className="font-bold text-indigo-600 dark:text-indigo-400">「設定」</span>タブから<br />
                <span className="font-bold text-indigo-600 dark:text-indigo-400">「サンプルデータの読み込み」</span><br />
                をクリックしてください。
              </p>
            </div>
          </div>
        ) : (
          sets.map((set) => (
            <div key={set.id} className="rounded-xl bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 shadow-sm relative group text-left">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">Set #{set.id}</span>
                <div className="flex gap-4">
                  <button onClick={() => handleEdit(set)} className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">編集</button>
                  <button onClick={() => handleDelete(set.id)} className="text-xs text-red-600 dark:text-red-400 font-bold uppercase">削除</button>
                </div>
              </div>

              <div className="space-y-2">
                {set.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg group-hover:bg-indigo-50/50 dark:group-hover:bg-indigo-900/10 transition">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-gray-800 dark:text-gray-200">{item.spelling}</span>
                      <span className="mx-2 text-gray-400">/</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{item.meaning}</span>
                    </div>
                    <button onClick={() => speak(item.spelling, 0.9)} className="p-1.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 transition active:scale-90"><span className="text-sm">🔊</span></button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 登録・編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
              <h3 className="font-bold text-gray-700 dark:text-gray-200">{editingSetId ? 'セットを編集' : 'セットを新規登録'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">✕</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <p className="text-xs text-gray-500">似た発音の単語を2つ以上登録してください。</p>
              <div className="space-y-4">
                {formItems.map((item, index) => (
                  <div key={index} className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 space-y-3 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-400">WORD {index + 1}</span>
                      {formItems.length > 2 && (
                        <button onClick={() => removeItem(index)} className="text-[10px] text-red-500 font-bold uppercase">削除</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input value={item.spelling} onChange={(e) => updateItem(index, 'spelling', e.target.value)} placeholder="綴り" className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                      <input value={item.meaning} onChange={(e) => updateItem(index, 'meaning', e.target.value)} placeholder="意味" className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addItem} className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition">+ 単語を追加</button>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3 bg-gray-50 dark:bg-gray-800/50 shrink-0 text-center">
              <button type="button" onClick={resetForm} className="flex-1 py-3 rounded-lg border border-gray-300 dark:border-gray-600 font-medium hover:bg-white dark:hover:bg-gray-700 transition">キャンセル</button>
              <button onClick={handleSubmit} className="flex-1 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition shadow-md">{editingSetId ? '更新する' : '登録する'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

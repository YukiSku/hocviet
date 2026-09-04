import { useState, useCallback } from 'react';
import { getRandomMinimalPairSet, getMinimalPairItems } from '../db';
import { useTTS } from '../hooks/useTTS';

const VOWELS = ['a', 'ă', 'â', 'e', 'ê', 'i', 'o', 'ô', 'ơ', 'u', 'ư'];

/**
 * フィッシャー–イェーツのシャッフル
 */
function shuffleArray(array) {
  const cloned = [...array];
  for (let i = cloned.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

export default function MinimalPairMode() {
  const { speak } = useTTS();
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState('minimal'); // 'minimal' | 'vowel'
  const [currentSet, setCurrentSet] = useState(null);
  const [items, setItems] = useState([]);
  const [correctItem, setCorrectItem] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [result, setResult] = useState(null); // 'correct' | 'incorrect'
  const [loading, setLoading] = useState(false);

  const loadNext = useCallback(async (targetMode = mode) => {
    setLoading(true);
    setSelectedId(null);
    setResult(null);

    try {
      if (targetMode === 'vowel') {
        const vowelItems = VOWELS.map(v => ({ id: v, spelling: v, meaning: '' }));

        // 直前と同じ問題にならないようにフィルター
        let candidates = vowelItems;
        if (correctItem && vowelItems.length > 1) {
          candidates = vowelItems.filter(v => String(v.id) !== String(correctItem.id));
        }

        const target = candidates[Math.floor(Math.random() * candidates.length)];
        setItems(vowelItems);
        setCorrectItem(target);
        setCurrentSet({ id: 'vowel-set' });
        speak(target.spelling, 0.9);
      } else {
        const set = await getRandomMinimalPairSet(currentSet?.id);
        if (set) {
          setCurrentSet(set);
          const allItems = await getMinimalPairItems(set.id);
          const shuffled = shuffleArray(allItems);

          setItems(shuffled);
          const target = shuffled[Math.floor(Math.random() * shuffled.length)];
          setCorrectItem(target);
          speak(target.spelling, 0.9);
        } else {
          setCurrentSet(null);
          setItems([]);
          setCorrectItem(null);
        }
      }
    } catch (e) {
      console.error('Failed to load next exercise:', e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentSet?.id, correctItem?.id, speak]);

  const handleStart = (selectedMode) => {
    setMode(selectedMode);
    setStarted(true);
    loadNext(selectedMode);
  };

  const handleSelect = (item) => {
    if (result || !correctItem) return;

    setSelectedId(item.id);
    // 型の違いを考慮して == で比較
    if (String(item.id) === String(correctItem.id)) {
      setResult('correct');
    } else {
      setResult('incorrect');
    }
  };

  if (!started) {
    return (
      <div className="rounded-2xl shadow-md bg-gray-50 dark:bg-gray-800 p-8 text-center space-y-8">
        <div className="space-y-2">
          <h2 className="text-xl font-bold">聞き分け練習 (Luyện nghe)</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            流れる音声を聞いて、正しい綴りを選択してください。
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm">
            <h3 className="text-sm font-bold mb-3 text-gray-600 dark:text-gray-300">基礎: 母音の聞き分け</h3>
            <button
              onClick={() => handleStart('vowel')}
              className="w-full rounded-lg bg-orange-500 text-white py-4 font-bold text-lg hover:bg-orange-600 active:scale-[0.98] transition shadow-md"
            >
              母音の聞き分け
            </button>
          </div>

          <div className="bg-white dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm">
            <h3 className="text-sm font-bold mb-3 text-gray-600 dark:text-gray-300">応用: 似た単語の聞き分け</h3>
            <button
              onClick={() => handleStart('minimal')}
              className="w-full rounded-lg bg-blue-600 text-white py-4 font-bold text-lg hover:bg-blue-700 active:scale-[0.98] transition shadow-md"
            >
              単語で練習開始 (Bắt đầu)
            </button>
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <span className="text-4xl animate-bounce">🎧</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return <p className="text-center py-10 text-gray-500 animate-pulse">読み込み中... (Đang tải...)</p>;
  }

  if (!currentSet || items.length === 0 || !correctItem) {
    return (
      <div className="text-center py-10 bg-gray-50 dark:bg-gray-800 rounded-2xl p-6">
        <p className="text-gray-500 dark:text-gray-400">データが登録されていません</p>
        <button
          onClick={() => setStarted(false)}
          className="text-blue-600 mt-4 underline text-sm"
        >
          戻る
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl shadow-md bg-gray-50 dark:bg-gray-800 p-6 space-y-6">
      <div className="flex justify-between items-center">
        <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-bold">
          {mode === 'vowel' ? '母音聞き分け (Nguyên âm)' : '単語聞き分け (Từ ngữ)'}
        </span>
        <button
          onClick={() => setStarted(false)}
          className="text-[10px] text-blue-600 dark:text-blue-400 underline"
        >
          終了する
        </button>
      </div>

      <div className="flex justify-center py-4">
        <button
          onClick={() => speak(correctItem.spelling, 0.9)}
          className={`w-24 h-24 rounded-full text-white shadow-lg flex flex-col items-center justify-center active:scale-90 transition transform ${mode === 'vowel' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          <span className="text-4xl">🔊</span>
          <span className="text-[10px] font-bold mt-1">REPLAY</span>
        </button>
      </div>

      <div className={mode === 'vowel' ? "grid grid-cols-3 gap-3" : "grid grid-cols-1 gap-3"}>
        {items.map((item) => {
          const isCorrect = String(correctItem.id) === String(item.id);
          const isSelected = String(selectedId) === String(item.id);

          let containerClass = "w-full rounded-xl border-2 font-medium transition-all flex justify-between items-center ";
          if (mode === 'vowel') {
            containerClass += "flex-col justify-center py-6 text-2xl ";
          } else {
            containerClass += "py-4 px-4 text-lg ";
          }

          if (result) {
            if (isCorrect) {
              containerClass += "bg-green-50 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300 ";
            } else if (isSelected) {
              containerClass += "bg-red-50 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300 ";
            } else {
              containerClass += "bg-white border-gray-200 text-gray-400 dark:bg-gray-700 dark:border-gray-600 opacity-50 ";
            }
          } else {
            containerClass += "bg-white border-gray-200 text-gray-700 hover:border-blue-400 active:scale-[0.98] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 ";
          }

          return (
            <div
              key={item.id}
              onClick={() => !result && handleSelect(item)}
              className={`${containerClass} ${!result ? 'cursor-pointer' : ''}`}
            >
              <div className={mode === 'vowel' ? "text-center" : "flex flex-col flex-1 min-w-0 text-left"}>
                <span className="truncate">{item.spelling}</span>
                {mode !== 'vowel' && <span className="text-xs opacity-70 font-normal truncate">{item.meaning}</span>}
              </div>

              {result && (
                <div className={`flex gap-2 shrink-0 ${mode === 'vowel' ? 'mt-2' : ''}`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); speak(item.spelling, 0.9); }}
                    className="p-2 rounded-lg bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200 text-sm active:scale-95 transition-all shadow-sm"
                    title="通常"
                  >
                    🔊
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); speak(item.spelling, 0.6); }}
                    className="p-2 rounded-lg bg-orange-100 dark:bg-orange-800 text-orange-600 dark:text-orange-200 text-sm active:scale-95 transition-all shadow-sm"
                    title="ゆっくり"
                  >
                    🐢
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {result && (
        <div className="pt-4 space-y-3">
          <p className={`text-center font-bold text-xl ${result === 'correct' ? 'text-green-600' : 'text-red-600'}`}>
            {result === 'correct' ? '正解！ (Chính xác!) 🎉' : '不正解 (Sai rồi) 😢'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => speak(correctItem.spelling, 0.9)}
              className="flex-1 rounded-lg bg-gray-200 dark:bg-gray-700 py-3 font-medium active:scale-[0.98] transition"
            >
              もう一度聞く
            </button>
            <button
              onClick={() => loadNext()}
              className={`flex-1 rounded-lg text-white py-3 font-medium active:scale-[0.98] transition ${mode === 'vowel' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {mode === 'vowel' ? '次の母音へ' : '次のセットへ'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useCallback } from 'react';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { getRandomMinimalPairSet, getMinimalPairItems } from '../db';

export default function MinimalPairMode() {
  const [started, setStarted] = useState(false);
  const [currentSet, setCurrentSet] = useState(null);
  const [items, setItems] = useState([]);
  const [correctItem, setCorrectItem] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [result, setResult] = useState(null); // 'correct' | 'incorrect'
  const [loading, setLoading] = useState(false);

  const speak = async (text, rate = 0.9) => {
    if (!text) return;
    try {
      await TextToSpeech.speak({
        text: text,
        lang: 'vi-VN',
        rate: rate,
        pitch: 1.0,
        volume: 1.1,
      });
    } catch (e) {
      console.error('TTS error:', e);
    }
  };

  const loadNextSet = useCallback(async () => {
    setLoading(true);
    setSelectedId(null);
    setResult(null);

    const set = await getRandomMinimalPairSet();
    if (set) {
      setCurrentSet(set);
      const allItems = await getMinimalPairItems(set.id);

      // シャッフル
      const shuffled = [...allItems].sort(() => Math.random() - 0.5);
      setItems(shuffled);

      // 正解をランダムに選択
      const target = shuffled[Math.floor(Math.random() * shuffled.length)];
      setCorrectItem(target);

      // 初回再生
      speak(target.spelling, 0.9);
    } else {
      setCurrentSet(null);
      setItems([]);
      setCorrectItem(null);
    }
    setLoading(false);
  }, []);

  const handleStart = () => {
    setStarted(true);
    loadNextSet();
  };

  const handleSelect = (item) => {
    if (result) return; // 判定済みなら何もしない

    setSelectedId(item.id);
    if (item.id === correctItem.id) {
      setResult('correct');
    } else {
      setResult('incorrect');
    }
  };

  if (!started) {
    return (
      <div className="rounded-2xl shadow-md bg-gray-50 dark:bg-gray-800 p-8 text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold">聞き分け練習 (Luyện nghe)</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            流れる音声を聞いて、正しい綴りを選択してください。
          </p>
        </div>
        <div className="flex justify-center py-4">
          <span className="text-6-xl animate-bounce">🎧</span>
        </div>
        <button
          onClick={handleStart}
          className="w-full rounded-lg bg-blue-600 text-white py-4 font-bold text-lg hover:bg-blue-700 active:scale-[0.98] transition shadow-lg"
        >
          開始する (Bắt đầu)
        </button>
      </div>
    );
  }

  if (loading) {
    return <p className="text-center py-10 text-gray-500 animate-pulse">読み込み中... (Đang tải...)</p>;
  }

  if (!currentSet || items.length === 0) {
    return (
      <div className="text-center py-10 bg-gray-50 dark:bg-gray-800 rounded-2xl p-6">
        <p className="text-gray-500 dark:text-gray-400">聞き分けデータが登録されていません</p>
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
          聞き分けモード (Luyện nghe)
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
          className="w-24 h-24 rounded-full bg-blue-600 text-white shadow-lg flex flex-col items-center justify-center active:scale-90 transition transform hover:bg-blue-700"
        >
          <span className="text-4xl">🔊</span>
          <span className="text-[10px] font-bold mt-1">REPLAY</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {items.map((item) => {
          const isCorrect = correctItem.id === item.id;
          const isSelected = selectedId === item.id;

          let containerClass = "w-full py-4 px-4 rounded-xl border-2 font-medium transition-all text-lg flex justify-between items-center ";

          if (result) {
            if (isCorrect) {
              containerClass += "bg-green-50 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300 ";
            } else if (isSelected) {
              containerClass += "bg-red-50 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300 ";
            } else {
              containerClass += "bg-white border-gray-200 text-gray-400 dark:bg-gray-700 dark:border-gray-600 opacity-50 ";
            }

            return (
              <div key={item.id} className={containerClass}>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="truncate">{item.spelling}</span>
                  <span className="text-xs opacity-70 font-normal truncate">{item.meaning}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => speak(item.spelling, 0.9)}
                    className="p-2 rounded-lg bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200 text-sm active:scale-90 transition"
                    title="通常"
                  >
                    🔊
                  </button>
                  <button
                    onClick={() => speak(item.spelling, 0.6)}
                    className="p-2 rounded-lg bg-orange-100 dark:bg-orange-800 text-orange-600 dark:text-orange-200 text-sm active:scale-90 transition"
                    title="ゆっくり"
                  >
                    🐢
                  </button>
                </div>
              </div>
            );
          }

          containerClass += "bg-white border-gray-200 text-gray-700 hover:border-blue-400 active:scale-[0.98] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 ";

          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className={containerClass}
            >
              <span>{item.spelling}</span>
              <span className="text-sm opacity-70 font-normal">{item.meaning}</span>
            </button>
          );
        })}
      </div>

      {result && (
        <div className="pt-4 space-y-3">
          <p className={`text-center font-bold text-xl ${result === 'correct' ? 'text-green-600' : 'text-red-600'}`}>
            {result === 'correct' ? '正解！ (Chính xác!)' : '不正解 (Sai rồi)'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => speak(correctItem.spelling, 0.9)}
              className="flex-1 rounded-lg bg-gray-200 dark:bg-gray-700 py-3 font-medium active:scale-[0.98] transition"
            >
              もう一度聞く
            </button>
            <button
              onClick={loadNextSet}
              className="flex-1 rounded-lg bg-blue-600 text-white py-3 font-medium hover:bg-blue-700 active:scale-[0.98] transition"
            >
              次のセットへ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

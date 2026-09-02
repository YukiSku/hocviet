import { useState, useMemo } from 'react';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { checkAnswer } from '../db';

export default function PracticeMode({ words, allTags, mode }) {
  const [selectedTags, setSelectedTags] = useState([]);
  const [started, setStarted] = useState(false);
  const [currentWord, setCurrentWord] = useState(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [attemptCount, setAttemptCount] = useState(1);

  const filteredWords = useMemo(() => {
    if (selectedTags.length === 0) return words;
    return words.filter(word =>
      word.tags.some(tag => selectedTags.includes(tag))
    );
  }, [words, selectedTags]);

  const handleSpeak = async (rate) => {
    if (!currentWord) return;
    try {
      const textToSpeak = currentWord.spelling.split(/[;；,，]/)[0].trim();
      await TextToSpeech.speak({
        text: textToSpeak,
        lang: 'vi-VN',
        rate: rate,
        pitch: 1.0,
        volume: 1.1,
      });
    } catch (e) {
      console.error('TTS error:', e);
      alert('音声の再生に失敗しました。ベトナム語の言語パックがインストールされているか確認してください。');
    }
  };

  function pickRandom(list) {
    if (!list || list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function handleStart() {
    if (filteredWords.length === 0) {
      alert('選択したタグに該当する単語がありません');
      return;
    }
    setCurrentWord(pickRandom(filteredWords));
    setStarted(true);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const isCorrect = checkAnswer(input, currentWord.spelling, mode);
    setResult(isCorrect ? 'correct' : 'incorrect');
  }

  function handleRepeat() {
    setInput('');
    setResult(null);
    setAttemptCount((c) => c + 1);
  }

  function handleStopRepeat() {
    setCurrentWord(pickRandom(filteredWords));
    setInput('');
    setResult(null);
    setAttemptCount(1);
  }

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  if (!started) {
    return (
      <div className="rounded-2xl shadow-md bg-gray-50 dark:bg-gray-800 p-6">
        <h2 className="text-lg font-bold mb-4">ジャンルを選択</h2>
        <div className="flex flex-wrap gap-2 mb-6">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {tag}
            </button>
          ))}
          {allTags.length === 0 && <p className="text-gray-500">タグがありません</p>}
        </div>
        <button
          onClick={handleStart}
          className="w-full rounded-lg bg-blue-600 text-white py-3 font-medium hover:bg-blue-700 active:scale-[0.98] transition"
        >
          {selectedTags.length > 0 ? `${selectedTags.length}個のジャンルで開始` : 'すべての単語で開始'}
        </button>
      </div>
    );
  }

  if (!currentWord) return null;

  return (
    <div className="rounded-2xl shadow-md bg-gray-50 dark:bg-gray-800 p-6">
      <div className="flex justify-between items-center mb-2">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {mode === 'word' ? '単語練習' : '練習'}
          </span>
          <div className="flex gap-1 mt-0.5">
            {currentWord.tags.map(tag => (
              <span key={tag} className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end">
          {attemptCount > 1 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {attemptCount}回目
            </span>
          )}
          <button
            onClick={() => {
              setStarted(false);
              setInput('');
              setResult(null);
              setAttemptCount(1);
            }}
            className="text-[10px] text-blue-600 dark:text-blue-400 underline mt-1"
          >
            ジャンル変更
          </button>
        </div>
      </div>

      <p className="text-2xl font-semibold text-center my-6">
        {currentWord.meaning}
      </p>

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={result !== null}
          placeholder="スペルを入力"
          autoFocus
          className={`w-full rounded-lg border px-4 py-3 text-lg text-center
            bg-white dark:bg-gray-700
            border-gray-300 dark:border-gray-600
            focus:outline-none focus:ring-2
            ${result === 'correct' ? 'ring-2 ring-green-500' : ''}
            ${result === 'incorrect' ? 'ring-2 ring-red-500' : ''}
            disabled:opacity-70`}
        />

        {result === null && (
          <button
            type="submit"
            className="w-full mt-4 rounded-lg bg-blue-600 text-white py-3 font-medium hover:bg-blue-700 active:scale-[0.98] transition"
          >
            回答する
          </button>
        )}
      </form>

      {result !== null && (
        <div className="mt-4 space-y-4">
          <div className="text-center space-y-2">
            <p
              className={`font-bold text-xl ${
                result === 'correct' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {result === 'correct' ? '正解！' : '不正解'}
            </p>

            <div className="flex flex-col items-center gap-2">
              <p className="text-2xl font-semibold">
                {currentWord.spelling.replace(/[;；,，]/g, ' / ')}
              </p>
              <div className="flex gap-4 mt-1">
                <button
                  onClick={() => handleSpeak(0.9)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800 active:scale-95 transition"
                  title="通常速度で再生"
                >
                  <span className="text-2xl">🔊</span>
                  <span className="text-[10px] font-bold">Normal</span>
                </button>
                <button
                  onClick={() => handleSpeak(0.6)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 border border-orange-100 dark:border-orange-800 active:scale-95 transition"
                  title="ゆっくり再生"
                >
                  <span className="text-2xl">🐢</span>
                  <span className="text-[10px] font-bold">Slow</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRepeat}
              className="flex-1 rounded-lg bg-blue-600 text-white py-3 font-medium hover:bg-blue-700 active:scale-[0.98] transition"
            >
              繰り返し練習
            </button>
            <button
              onClick={handleStopRepeat}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-3 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-[0.98] transition"
            >
              繰り返しをやめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

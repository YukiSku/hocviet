import { useState } from 'react';

function stripToneMarks(str) {
  return str.normalize('NFD').replace(/[\u0300\u0301\u0303\u0309\u0323]/g, '').normalize('NFC');
}

function normalize(str, mode) {
  const trimmed = str.trim().toLowerCase();
  return mode === 'beginner' ? stripToneMarks(trimmed) : trimmed;
}

export default function PracticeMode({ words, mode }) {
  const [currentWord, setCurrentWord] = useState(() => pickRandom(words));
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [attemptCount, setAttemptCount] = useState(1);

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const isCorrect = normalize(input, mode) === normalize(currentWord.spelling, mode);
    setResult(isCorrect ? 'correct' : 'incorrect');
  }

  function handleRepeat() {
    setInput('');
    setResult(null);
    setAttemptCount((c) => c + 1);
  }

  function handleStopRepeat() {
    setCurrentWord(pickRandom(words));
    setInput('');
    setResult(null);
    setAttemptCount(1);
  }

  return (
    <div className="rounded-2xl shadow-md bg-gray-50 dark:bg-gray-800 p-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {mode === 'beginner' ? 'Beginner' : 'Normal'}
        </span>
        {attemptCount > 1 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {attemptCount}回目
          </span>
        )}
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
        <div className="mt-4 space-y-3">
          <p
            className={`text-center font-medium ${
              result === 'correct' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {result === 'correct' ? '正解！' : `不正解：${currentWord.spelling}`}
          </p>

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
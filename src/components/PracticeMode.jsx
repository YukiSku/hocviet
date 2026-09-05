import { useState, useMemo, useRef, useEffect } from 'react';
import { checkAnswer, updateWordNote } from '../db';
import { useTTS } from '../hooks/useTTS';

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

export default function PracticeMode({ words, allTags, mode }) {
  const { speak } = useTTS();
  const [selectedTags, setSelectedTags] = useState([]);
  const [started, setStarted] = useState(false);
  const [practiceType, setPracticeType] = useState('input'); // 'input' | 'choice'
  const [currentWord, setCurrentWord] = useState(null);
  const [options, setOptions] = useState([]); // 選択肢用
  const [input, setInput] = useState('');
  const [selectedId, setSelectedId] = useState(null); // 選択モード用
  const [result, setResult] = useState(null);
  const [attemptCount, setAttemptCount] = useState(1);
  const [editingNote, setEditingNote] = useState(null);
  const inputRef = useRef(null);

  // 回答待ち状態（resultがnull）になったら自動でフォーカスを当てる
  useEffect(() => {
    if (started && practiceType === 'input' && result === null) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [started, practiceType, result, currentWord]);

  const filteredWords = useMemo(() => {
    if (selectedTags.length === 0) return words;
    return words.filter(word =>
      word.tags.some(tag => selectedTags.includes(tag))
    );
  }, [words, selectedTags]);

  const handleSpeak = async (text, rate = 0.9) => {
    await speak(text, rate);
  };

  function pickRandom(list, excludeId = null) {
    if (!list || list.length === 0) return null;
    let candidates = list;
    if (excludeId !== null && list.length > 1) {
      candidates = list.filter(w => w.id !== excludeId);
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * 選択肢を生成する
   */
  function generateOptions(targetWord, allCandidates) {
    const count = Math.floor(Math.random() * 3) + 3; // 3〜5個
    let others = allCandidates.filter(w => w.id !== targetWord.id);

    // 候補が足りない場合は、filtered 以外の全単語からも持ってくる
    if (others.length < count - 1) {
      others = words.filter(w => w.id !== targetWord.id);
    }

    const selectedOthers = shuffleArray(others).slice(0, count - 1);
    return shuffleArray([targetWord, ...selectedOthers]);
  }

  function handleStart(type) {
    if (filteredWords.length === 0) {
      alert('選択したタグに該当する単語がありません');
      return;
    }
    const word = pickRandom(filteredWords);
    setCurrentWord(word);
    setPracticeType(type);

    if (type === 'choice') {
      setOptions(generateOptions(word, filteredWords));
    }

    setStarted(true);
    setEditingNote(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const isCorrect = checkAnswer(input, currentWord.spelling, mode);
    setResult(isCorrect ? 'correct' : 'incorrect');
  }

  function handleSelect(word) {
    if (result) return;
    setSelectedId(word.id);
    if (word.id === currentWord.id) {
      setResult('correct');
    } else {
      setResult('incorrect');
    }
  }

  function handleRepeat() {
    setInput('');
    setSelectedId(null);
    setResult(null);
    setAttemptCount((c) => c + 1);
    setEditingNote(null);

    if (practiceType === 'choice') {
      setOptions(generateOptions(currentWord, filteredWords));
    }
  }

  function handleStopRepeat() {
    const nextWord = pickRandom(filteredWords, currentWord?.id);
    setCurrentWord(nextWord);
    setInput('');
    setSelectedId(null);
    setResult(null);
    setAttemptCount(1);
    setEditingNote(null);

    if (practiceType === 'choice') {
      setOptions(generateOptions(nextWord, filteredWords));
    }
  }

  async function handleSaveNote() {
    if (!currentWord) return;
    await updateWordNote(currentWord.id, editingNote);
    setCurrentWord({ ...currentWord, note: editingNote });
    setEditingNote(null);
  }

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  if (!started) {
    return (
      <div className="rounded-2xl shadow-md bg-gray-50 dark:bg-gray-800 p-6 space-y-6">
        <h2 className="text-lg font-bold mb-2 text-center">練習設定</h2>

        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">ジャンルを選択</h3>
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider underline underline-offset-2"
              >
                選択をクリア
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                }`}
              >
                {tag}
              </button>
            ))}
            {allTags.length === 0 && <p className="text-gray-500">タグがありません</p>}
          </div>
        </div>

        <div className="space-y-5 pt-4">
          {words.length >= 3 && (
            <button
              onClick={() => handleStart('choice')}
              className="w-full rounded-xl bg-indigo-600 text-white py-4 font-bold hover:bg-indigo-700 active:scale-[0.98] transition shadow-md"
            >
              {selectedTags.length > 0 ? `${selectedTags.length}個のジャンルで` : 'すべての単語で'}選択練習を開始
            </button>
          )}

          <button
            onClick={() => handleStart('input')}
            className="w-full rounded-xl bg-blue-600 text-white py-4 font-bold hover:bg-blue-700 active:scale-[0.98] transition shadow-md"
          >
            {selectedTags.length > 0 ? `${selectedTags.length}個のジャンルで` : 'すべての単語で'}入力練習を開始
          </button>
        </div>
      </div>
    );
  }

  if (!currentWord) return null;

  return (
    <div className="rounded-2xl shadow-md bg-gray-50 dark:bg-gray-800 p-6 space-y-6">
      <div className="flex justify-between items-center mb-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {practiceType === 'input' ? 'スペル入力練習' : '意味から選択練習'}
          </span>
          <div className="flex gap-1 mt-1">
            {currentWord.tags.map(tag => (
              <span key={tag} className="text-[9px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 font-bold">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end">
          {attemptCount > 1 && (
            <span className="text-[10px] text-gray-400 font-bold">
              {attemptCount}回目
            </span>
          )}
          <button
            onClick={() => setStarted(false)}
            className="text-[10px] text-blue-600 dark:text-blue-400 underline mt-1 font-bold"
          >
            ジャンル・モード変更
          </button>
        </div>
      </div>

      <div className="text-center py-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">意味から綴りを当てる</p>
        <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 leading-tight">
          {currentWord.meaning}
        </p>
      </div>

      {practiceType === 'input' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={result !== null}
            placeholder="スペルを入力"
            autoFocus
            className={`w-full rounded-xl border px-4 py-4 text-xl text-center font-medium
              bg-white dark:bg-gray-700
              border-gray-200 dark:border-gray-600
              focus:outline-none focus:ring-4 focus:ring-blue-500/20
              ${result === 'correct' ? 'ring-4 ring-green-500/30 border-green-500' : ''}
              ${result === 'incorrect' ? 'ring-4 ring-red-500/30 border-red-500' : ''}
              disabled:opacity-80 transition-all`}
          />

          {result === null && (
            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 text-white py-4 font-bold text-lg hover:bg-blue-700 active:scale-[0.98] transition shadow-lg"
            >
              回答する
            </button>
          )}
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {options.map((option) => {
            const isTarget = option.id === currentWord.id;
            const isSelected = option.id === selectedId;

            let btnClass = "w-full p-4 rounded-xl border-2 font-bold transition-all text-lg flex justify-between items-center ";

            if (result) {
              if (isTarget) {
                btnClass += "bg-green-50 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300 ";
              } else if (isSelected) {
                btnClass += "bg-red-50 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300 ";
              } else {
                btnClass += "bg-white border-gray-100 text-gray-300 dark:bg-gray-800 dark:border-gray-700 opacity-40 ";
              }
            } else {
              btnClass += "bg-white border-gray-200 text-gray-700 hover:border-indigo-400 active:scale-[0.98] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 shadow-sm ";
            }

            return (
              <div key={option.id} className={btnClass} onClick={() => handleSelect(option)}>
                <span className="flex-1 text-left truncate">{option.spelling}</span>
                {result && (
                  <div className="flex gap-2 shrink-0 ml-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSpeak(option.spelling, 0.9); }}
                      className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 active:scale-90 transition"
                    >
                      🔊
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSpeak(option.spelling, 0.6); }}
                      className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 active:scale-90 transition"
                    >
                      🐢
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {result !== null && (
        <div className="mt-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-center space-y-4">
            <p className={`font-black text-2xl ${result === 'correct' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {result === 'correct' ? '正解（Chính xác!） 🎉' : '不正解（Sai rồi） 😢'}
            </p>

            {practiceType === 'input' && (
              <div className="flex flex-col items-center gap-3 bg-white dark:bg-gray-700/30 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400">
                  {currentWord.spelling.replace(/[;；,，]/g, ' / ')}
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => handleSpeak(currentWord.spelling, 0.9)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800 active:scale-95 transition shadow-sm"
                  >
                    <span className="text-2xl">🔊</span>
                    <span className="text-[10px] font-black uppercase">Normal</span>
                  </button>
                  <button
                    onClick={() => handleSpeak(currentWord.spelling, 0.6)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 border border-orange-100 dark:border-orange-800 active:scale-95 transition shadow-sm"
                  >
                    <span className="text-2xl">🐢</span>
                    <span className="text-[10px] font-black uppercase">Slow</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRepeat}
              className="flex-1 rounded-xl bg-blue-600 text-white py-4 font-bold hover:bg-blue-700 active:scale-[0.98] transition shadow-lg"
            >
              もう一度
            </button>
            <button
              onClick={handleStopRepeat}
              className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-700 py-4 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-[0.98] transition"
            >
              次へ
            </button>
          </div>

          {/* メモ表示・編集エリア */}
          <div className="bg-white dark:bg-gray-700/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ghi chú (メモ・例文)</span>
              {editingNote === null ? (
                <button
                  onClick={() => setEditingNote(currentWord.note || '')}
                  className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingNote(null)}
                    className="text-[10px] text-gray-500 font-black uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNote}
                    className="text-[10px] text-green-600 font-black uppercase"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            {editingNote === null ? (
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed italic">
                {currentWord.note || <span className="text-gray-400">メモはありません</span>}
              </p>
            ) : (
              <textarea
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                autoFocus
                className="w-full text-sm bg-transparent border-none focus:ring-0 p-0 text-gray-700 dark:text-gray-200 resize-none min-h-[80px]"
                placeholder="例文や補足情報を入力..."
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

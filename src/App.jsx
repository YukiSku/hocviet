import { useEffect, useState } from 'react';
import { initDb, getAllWords, getAllTags } from './db';
import { loadInitialDataIfFirstTime } from './initialData';
import { getTheme, setTheme as saveTheme } from './settings';
import PracticeMode from './components/PracticeMode';
import MinimalPairMode from './components/MinimalPairMode';
import MasterMode from './components/MasterMode';
import SettingsPanel from './components/SettingsPanel';

function App() {
  const [dbReady, setDbReady] = useState(false);
  const [tab, setTab] = useState('practice'); // 'practice' | 'minimal' | 'master' | 'settings'
  const [words, setWords] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [theme, setThemeState] = useState('system');
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        await initDb();
        await loadInitialDataIfFirstTime();
        setWords(await getAllWords());
        setAllTags(await getAllTags());
        const savedTheme = await getTheme();
        setThemeState(savedTheme);
        setDbReady(true);
      } catch (err) {
        console.error('DB init failed:', err);
        setInitError(err.message ?? String(err));
      }
    })();
  }, []);

  useEffect(() => {
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, [theme]);

  useEffect(() => {
    if (tab === 'practice') {
      getAllWords().then(setWords);
      getAllTags().then(setAllTags);
    }
  }, [tab]);

  async function handleThemeChange(newTheme) {
    setThemeState(newTheme);
    await saveTheme(newTheme);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors pb-8">
      <div className="max-w-md mx-auto p-4">
        {initError ? (
          <div className="p-4 text-center text-red-600">
            <p>データベースの初期化に失敗しました</p>
            <p className="text-xs mt-2">{initError}</p>
          </div>
        ) : !dbReady ? (
          <p className="text-center mt-12 text-gray-500 animate-pulse">
            読み込み中... (Đang tải...)
          </p>
        ) : (
          <>
            <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 py-2 mb-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setTab('practice')}
                  className={`flex-1 py-2 rounded-lg font-medium text-xs ${tab === 'practice' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  単語練習
                </button>
                <button
                  onClick={() => setTab('minimal')}
                  className={`flex-1 py-2 rounded-lg font-medium text-xs ${tab === 'minimal' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  聞き分け
                </button>
                <button
                  onClick={() => setTab('master')}
                  className={`flex-1 py-2 rounded-lg font-medium text-xs ${tab === 'master' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  単語管理
                </button>
                <button
                  onClick={() => setTab('settings')}
                  className={`flex-1 py-2 rounded-lg font-medium text-xs ${tab === 'settings' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  設定
                </button>
              </div>
            </div>

            <div className="mt-2">
              {tab === 'practice' && (
                words.length > 0
                  ? <PracticeMode words={words} allTags={allTags} mode="word" />
                  : <p className="text-center text-gray-500 dark:text-gray-400">先に単語を登録してください</p>
              )}
              {tab === 'minimal' && <MinimalPairMode />}
              {tab === 'master' && <MasterMode />}
              {tab === 'settings' && (
                <SettingsPanel
                  theme={theme}
                  onThemeChange={handleThemeChange}
                  onImportDone={async () => setWords(await getAllWords())}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
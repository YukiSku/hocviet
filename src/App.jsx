import { useEffect, useState } from 'react';
import { initDb, getAllWords } from './db';
import { getTheme, setTheme as saveTheme } from './settings';
import PracticeMode from './components/PracticeMode';
import MasterMode from './components/MasterMode';
import SettingsPanel from './components/SettingsPanel';

function App() {
    const [dbReady, setDbReady] = useState(false);
    const [tab, setTab] = useState('practice'); // 'practice' | 'master' | 'settings'
    const [words, setWords] = useState([]);
    const [theme, setThemeState] = useState('system');
    const [initError, setInitError] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                await initDb();
                setWords(await getAllWords());
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
        }
    }, [tab]);

    async function handleThemeChange(newTheme) {
        setThemeState(newTheme);
        await saveTheme(newTheme);
    }

    if (initError) {
        return (
            <div className="p-4 text-center text-red-600">
                <p>データベースの初期化に失敗しました</p>
                <p className="text-xs mt-2">{initError}</p>
            </div>
        );
    }
    if (!dbReady) return <p className="text-center mt-8">読み込み中...</p>;

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
          <div className="max-w-md mx-auto p-4">
            <h1 className="text-base font-bold mb-4">Tôi đang phát triển ứng dụng.</h1>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTab('practice')}
                className={`flex-1 py-2 rounded-lg font-medium ${tab === 'practice' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                練習
              </button>
              <button
                onClick={() => setTab('master')}
                className={`flex-1 py-2 rounded-lg font-medium ${tab === 'master' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                単語管理
              </button>
              <button
                onClick={() => setTab('settings')}
                className={`flex-1 py-2 rounded-lg font-medium ${tab === 'settings' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                設定
              </button>
            </div>

            {tab === 'practice' && (
              words.length > 0
                ? <PracticeMode words={words} mode="beginner" />
                : <p className="text-center text-gray-500 dark:text-gray-400">先に単語を登録してください</p>
            )}
            {tab === 'master' && <MasterMode />}
            {tab === 'settings' && (
              <SettingsPanel
                theme={theme}
                onThemeChange={handleThemeChange}
                onImportDone={async () => setWords(await getAllWords())}
              />
            )}
          </div>
        </div>
    );
    }

export default App;
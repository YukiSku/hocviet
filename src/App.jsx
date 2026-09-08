import { useEffect, useState } from 'react';
import { initDb, getAllWords, getAllTags } from './db';
import { loadInitialDataIfFirstTime } from './initialData';
import { getTheme, setTheme as saveTheme } from './settings';
import PracticeMode from './components/PracticeMode';
import MinimalPairMode from './components/MinimalPairMode';
import MasterMode from './components/MasterMode';
import SettingsPanel from './components/SettingsPanel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// グローバルでの初期化エラーを防ぐため、オプションを明示的に指定
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [dbReady, setDbReady] = useState(false);
  const [tab, setTab] = useState('practice'); // 'practice' | 'minimal' | 'master' | 'settings'
  const [allTags, setAllTags] = useState([]);
  const [theme, setThemeState] = useState('system');
  const [initError, setInitError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // 5%〜15%: データベースの初期化
        setLoadingStatus('Initializing DB...');
        setLoadingProgress(5);
        await initDb();
        setLoadingProgress(15);

        // 15%〜85%: 初期データの確認・読み込み
        setLoadingStatus('Loading Vocabulary...');
        await loadInitialDataIfFirstTime((p) => {
          // pは0〜100で来るので、15〜85の範囲に変換
          setLoadingProgress(Math.floor(15 + (p * 0.7)));
        });
        setLoadingProgress(85);

        // 85%〜95%: 単語やタグの取得、UIの準備
        setLoadingStatus('Preparing UI...');
        const t = await getAllTags();
        setAllTags(t);
        setLoadingProgress(95);

        // 95%〜100%: 設定の読み込みと最終処理
        setLoadingStatus('Starting App...');
        const savedTheme = await getTheme();
        setThemeState(savedTheme);
        setLoadingProgress(100);

        // 完了後、少しだけ待ってから画面を切り替える
        setTimeout(() => setDbReady(true), 500);
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
    if (tab === 'practice' || tab === 'master') {
      getAllTags().then(setAllTags);
    }
  }, [tab]);

  async function handleThemeChange(newTheme) {
    setThemeState(newTheme);
    await saveTheme(newTheme);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors pb-8"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
      >
        <div className="max-w-md mx-auto p-4">
          {initError ? (
            <div className="p-4 text-center text-red-600">
              <p>データベースの初期化に失敗しました</p>
              <p className="text-xs mt-2">{initError}</p>
            </div>
          ) : !dbReady ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in duration-700">
              <div className="text-center space-y-1">
                <p className="text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">Repeat & Learn</p>
                <p className="text-2xl font-bold italic text-gray-700 dark:text-gray-200">Tiếng Việt</p>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 pt-2">Viết nhiều, nhớ lâu!</p>
              </div>

              <div className="w-full max-w-[240px] space-y-3">
                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-500 ease-out rounded-full shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center px-1">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    {loadingStatus}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    {loadingProgress}%
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 py-2">
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
                    マスタ管理
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
                  <PracticeMode allTags={allTags} mode="word" />
                )}
                {tab === 'minimal' && <MinimalPairMode />}
                {tab === 'master' && <MasterMode />}
                {tab === 'settings' && (
                  <SettingsPanel
                    theme={theme}
                    onThemeChange={handleThemeChange}
                    onImportDone={async () => {
                      await queryClient.resetQueries({ queryKey: ['words'] });
                      setAllTags(await getAllTags());
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;
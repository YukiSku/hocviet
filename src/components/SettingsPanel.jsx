import { useRef, useState, useEffect } from 'react';
import { NativeSettings, AndroidSettings } from 'capacitor-native-settings';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { parseCsv } from '../csv';
import { importWordsFromCsv, importMinimalPairsFromCsv } from '../db';

export default function SettingsPanel({ theme, onThemeChange, onImportDone }) {
  const fileInputRef = useRef(null);
  const minimalPairInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState(null); // { count } | { error }
  const [minimalPairStatus, setMinimalPairStatus] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isMinimalImporting, setIsMinimalImporting] = useState(false);
  const [isViSupported, setIsViSupported] = useState(true);

  useEffect(() => {
    checkLanguageSupport();
  }, []);

  async function checkLanguageSupport() {
    try {
      const { languages } = await TextToSpeech.getSupportedLanguages();
      // 言語リストに 'vi-VN' または 'vi' が含まれているか確認
      const supported = languages.some(l => l.toLowerCase().includes('vi'));
      setIsViSupported(supported);
    } catch (e) {
      console.error('Failed to check language support', e);
    }
  }

  async function openSystemSettings() {
    try {
      await NativeSettings.openAndroid({
        option: AndroidSettings.Locale
      });
    } catch (e) {
      // Fallback to Application Details if Locale fails or on iOS (though request was for Android context)
      try {
        await NativeSettings.openAndroid({ option: AndroidSettings.ApplicationDetails });
      } catch (err) {
        alert('設定画面を開けませんでした。手動で設定アプリから変更してください。');
      }
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rows = parseCsv(event.target.result);
        const count = await importWordsFromCsv(rows);
        setImportStatus({ count });
        onImportDone?.();
      } catch (err) {
        setImportStatus({ error: err.message });
      } finally {
        setIsImporting(false);
      }
    };
    reader.onerror = () => {
      setImportStatus({ error: 'ファイルの読み込みに失敗しました' });
      setIsImporting(false);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = ''; // 同じファイルを連続選択できるようにリセット
  }

  function handleMinimalPairFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    setIsMinimalImporting(true);
    setMinimalPairStatus(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rows = parseCsv(event.target.result);
        const count = await importMinimalPairsFromCsv(rows);
        setMinimalPairStatus({ count });
        // 聞き分けモードのインポート完了時も、必要ならリフレッシュなどの処理を追加可能
      } catch (err) {
        setMinimalPairStatus({ error: err.message });
      } finally {
        setIsMinimalImporting(false);
      }
    };
    reader.onerror = () => {
      setMinimalPairStatus({ error: 'ファイルの読み込みに失敗しました' });
      setIsMinimalImporting(false);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">テーマ</h2>
        <div className="flex gap-2">
          {['light', 'dark', 'system'].map((option) => (
            <button
              key={option}
              onClick={() => onThemeChange(option)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                theme === option
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              {option === 'light' ? 'ライト' : option === 'dark' ? 'ダーク' : '端末設定に従う'}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">言語と音声の設定</h2>
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-start gap-3">
            <span className={`text-xl ${isViSupported ? 'text-green-500' : 'text-orange-500'}`}>
              {isViSupported ? '✅' : '⚠️'}
            </span>
            <div>
              <p className="text-sm font-bold">ベトナム語 (vi-VN)</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isViSupported
                  ? '音声機能を利用可能です。'
                  : 'お使いの端末でベトナム語の音声合成が検出されませんでした。'}
              </p>
            </div>
          </div>

          {!isViSupported && (
            <p className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg">
              音声機能やベトナム語キーボードを使用するには、OSの設定から言語パッケージをインストールする必要があります。
            </p>
          )}

          <button
            onClick={openSystemSettings}
            className="w-full py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium transition"
          >
            OSの言語設定を開く
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">単語のCSVインポート</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          1列目: spelling（スペル）、2列目: meaning（意味）、3列目: tags（カンマ区切り可）
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className={`w-full rounded-lg border py-3 font-medium transition-colors ${
            isImporting
              ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
              : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {isImporting ? 'インポート中... (Đang nhập...)' : 'CSVファイルを選択'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {isImporting && (
          <div className="flex justify-center mt-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        )}

        {importStatus?.count !== undefined && !isImporting && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">
            {importStatus.count}件の単語をインポートしました
          </p>
        )}
        {importStatus?.error && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            エラー: {importStatus.error}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">聞き分けセットCSVインポート</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          1列目: set_id（グループID）、2列目: spelling、3列目: meaning
        </p>
        <button
          onClick={() => minimalPairInputRef.current?.click()}
          disabled={isMinimalImporting}
          className={`w-full rounded-lg border py-3 font-medium transition-colors ${
            isMinimalImporting
              ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
              : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {isMinimalImporting ? 'インポート中... (Đang nhập...)' : '聞き分けセットCSVを選択'}
        </button>
        <input
          ref={minimalPairInputRef}
          type="file"
          accept=".csv"
          onChange={handleMinimalPairFileSelect}
          className="hidden"
        />

        {isMinimalImporting && (
          <div className="flex justify-center mt-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        )}

        {minimalPairStatus?.count !== undefined && !isMinimalImporting && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">
            {minimalPairStatus.count}件のアイテムをインポートしました
          </p>
        )}
        {minimalPairStatus?.error && !isMinimalImporting && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            エラー: {minimalPairStatus.error}
          </p>
        )}
      </section>
    </div>
  );
}

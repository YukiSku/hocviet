import { useRef, useState } from 'react';
import { parseCsv } from '../csv';
import { importWordsFromCsv } from '../db';

export default function SettingsPanel({ theme, onThemeChange, onImportDone }) {
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState(null); // { count } | { error }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rows = parseCsv(event.target.result);
        const count = await importWordsFromCsv(rows);
        setImportStatus({ count });
        onImportDone?.();
      } catch (err) {
        setImportStatus({ error: err.message });
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = ''; // 同じファイルを連続選択できるようにリセット
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
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">単語のCSVインポート</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          1列目: spelling（スペル）、2列目: meaning（意味）、3列目: tags（カンマ区切り可）
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 py-3 font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          CSVファイルを選択
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {importStatus?.count !== undefined && (
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
    </div>
  );
}
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
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">サンプルデータの読み込み</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          アプリに最初から用意されている基本単語リストを読み込みます。既存の単語は重複登録されません。
        </p>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const { loadSampleVocabulary } = await import('../initialData');
                const count = await loadSampleVocabulary();
                alert(`${count}件の新規単語を追加しました。`);
                onImportDone?.();
              } catch (e) {
                alert('読み込みに失敗しました。');
              }
            }}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-3 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            基本単語を読み込む
          </button>
          <button
            onClick={async () => {
              try {
                const { loadSampleMinimalPairs } = await import('../initialData');
                const count = await loadSampleMinimalPairs();
                alert(`${count}件の聞き分けセットを追加しました。`);
              } catch (e) {
                alert('読み込みに失敗しました。');
              }
            }}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-3 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            聞き分けセットを読み込む
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">単語のCSVインポート</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          1列目: spelling、2列目: meaning、3列目: tags（カンマ区切り）、4列目: note（メモ/例文）
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

      <section className="pt-6 border-t border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">ライセンス情報</h2>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-[10px] text-gray-400 dark:text-gray-500 space-y-4 leading-relaxed">
          <div className="space-y-1">
            <p className="text-gray-500 dark:text-gray-400">Copyright © 2026 Yuuki Sakano (@yukisku) All Rights Reserved.</p>
            <p className="whitespace-pre-wrap">
              本ソフトウェアおよび関連する文書のファイル（以下「ソフトウェア」）の複製を取得した全ての人物に対し、以下の条件に従うことを前提に、ソフトウェアを無制限に扱うことを無償で許可します。これには、ソフトウェアの複製を使用、複製、改変、結合、公開、頒布、再許諾、および/または販売する権利、およびソフトウェアを提供する人物に同様の行為を許可する権利が含まれますが、これらに限定されません。
              {"\n\n"}
              上記の著作権表示および本許諾表示を、ソフトウェアの全ての複製または実質的な部分に記載するものとします。
              {"\n\n"}
              ソフトウェアは「現状有姿」で提供され、商品性、特定目的への適合性、および権利の非侵害性に関する保証を含むがこれらに限定されず、明示的であるか黙示的であるかを問わず、いかなる種類の保証も行われません。著作者または著作権者は、契約、不法行為、またはその他の行為であるかを問わず、ソフトウェアまたはソフトウェアの使用もしくはその他に取り扱いに起因または関連して生じるいかなる請求、損害賠償、その他の責任について、一切の責任を負いません。
            </p>
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <p className="font-bold text-gray-500 dark:text-gray-400">サードパーティ・ライセンス</p>
            <p>本アプリは以下のオープンソースソフトウェアを使用しています。</p>

            <div className="space-y-1">
              <p className="font-semibold">[MIT License]</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>React: Copyright © Meta Platforms, Inc.</li>
                <li>Capacitor: Copyright © Ionic</li>
                <li>capacitor-native-settings: Copyright © Robin Genz</li>
                <li>@capacitor-community/sqlite: Copyright © Capacitor Community</li>
                <li>@capacitor-community/text-to-speech: Copyright © Capacitor Community</li>
                <li>Tailwind CSS: Copyright © Tailwind Labs, Inc.</li>
                <li>Vite: Copyright © Evan You and Vite contributors</li>
              </ul>
            </div>

            <div className="space-y-1 pt-1">
              <p className="font-semibold">[Apache License 2.0]</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>AndroidX Libraries: Copyright © The Android Open Source Project</li>
                <li>Google Play Services: Copyright © Google LLC</li>
              </ul>
              <p className="mt-1 opacity-80">
                Licensed under the Apache License, Version 2.0 (the "License");
                you may not use this file except in compliance with the License.
                You may obtain a copy of the License at: http://www.apache.org/licenses/LICENSE-2.0
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { useRef, useState, useEffect } from 'react';
import { NativeSettings, AndroidSettings } from 'capacitor-native-settings';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { parseCsv } from '../csv';
import {
  importWordsFromCsv, importMinimalPairsFromCsv,
  exportFullBackup, importFullBackup, IMPORT_MODE, getAllTags
} from '../db';
import { loadSampleVocabulary, loadSampleMinimalPairs } from '../initialData';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export default function SettingsPanel({ theme, onThemeChange, onImportDone }) {
  const fileInputRef = useRef(null);
  const minimalPairInputRef = useRef(null);
  const backupInputRef = useRef(null);

  const [importStatus, setImportStatus] = useState(null);
  const [minimalPairStatus, setMinimalPairStatus] = useState(null);
  const [backupStatus, setBackupStatus] = useState(null);

  const [isImporting, setIsImporting] = useState(false);
  const [isMinimalImporting, setIsMinimalImporting] = useState(false);
  const [isBackupProcessing, setIsBackupProcessing] = useState(false);
  const [importMode, setImportMode] = useState(IMPORT_MODE.SKIP);

  const [isViSupported, setIsViSupported] = useState(true);

  useEffect(() => {
    checkLanguageSupport();
  }, []);

  async function checkLanguageSupport() {
    try {
      const { languages } = await TextToSpeech.getSupportedLanguages();
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
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
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
      } catch (err) {
        setMinimalPairStatus({ error: err.message });
      } finally {
        setIsMinimalImporting(false);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }

  async function handleExport(method = 'share') {
    try {
      const data = await exportFullBackup();
      const fileName = `hocviet_backup_${new Date().toISOString().split('T')[0]}.json`;
      const jsonStr = JSON.stringify(data, null, 2);

      if (method === 'download') {
        // 端末のDocumentsフォルダ（アプリ専用領域）へ保存
        try {
          await Filesystem.writeFile({
            path: fileName,
            data: jsonStr,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
            recursive: true
          });
          alert('端末の「Documents」フォルダ内に保存しました。');
        } catch (e) {
          console.error('Direct save failed:', e);
          alert('直接保存に失敗しました。共有機能をお試しください。');
        }
        return;
      }

      // 従来の共有シート (改良版)
      await Filesystem.writeFile({
        path: fileName,
        data: jsonStr,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      const { uri } = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Cache
      });

      // url ではなく files 配列を使うことで、Androidの「ファイルへコピー」が出やすくなる
      await Share.share({
        title: 'hocviet バックアップ',
        files: [uri],
        dialogTitle: 'バックアップを保存・送信'
      });
    } catch (err) {
      console.error('Export failed:', err);
      alert('バックアップの作成に失敗しました。');
    }
  }

  function handleBackupSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (importMode === IMPORT_MODE.RESTORE) {
      if (!confirm('現在のすべてのデータが削除され、バックアップの内容に置き換わります。よろしいですか？')) {
        e.target.value = '';
        return;
      }
    }
    setIsBackupProcessing(true);
    setBackupStatus(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const result = await importFullBackup(data, importMode);
        setBackupStatus({ success: true, ...result });
        onImportDone?.();
      } catch (err) {
        setBackupStatus({ error: 'バックアップファイルの形式が正しくありません' });
      } finally {
        setIsBackupProcessing(false);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }

  return (
    <div className="space-y-8 pb-10">
      <section>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">テーマ</h2>
        <div className="flex gap-2">
          {['light', 'dark', 'system'].map((option) => (
            <button
              key={option}
              onClick={() => onThemeChange(option)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                theme === option
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              {option === 'light' ? 'ライト' : option === 'dark' ? 'ダーク' : 'システム'}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider text-left">言語と音声の設定</h2>
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-start gap-3">
            <span className={`text-xl ${isViSupported ? 'text-green-500' : 'text-orange-500'}`}>
              {isViSupported ? '✅' : '⚠️'}
            </span>
            <div>
              <p className="text-sm font-bold text-left">ベトナム語 (vi-VN)</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 text-left">
                {isViSupported
                  ? '音声機能を利用可能です。'
                  : 'お使いの端末でベトナム語の音声合成が検出されませんでした。'}
              </p>
            </div>
          </div>
          {!isViSupported && (
            <p className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg text-left">
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
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider text-left">一括操作とサンプル</h2>
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest text-left">サンプルデータ</h3>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    const count = await loadSampleVocabulary();
                    alert(`${count}件の新規単語を追加しました。`);
                    onImportDone?.();
                  } catch (e) {
                    alert('読み込みに失敗しました。');
                  }
                }}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-3 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                基本単語
              </button>
              <button
                onClick={async () => {
                  try {
                    const count = await loadSampleMinimalPairs();
                    alert(`${count}件の聞き分けセットを追加しました。`);
                  } catch (e) {
                    alert('読み込みに失敗しました。');
                  }
                }}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-3 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                聞き分けセット
              </button>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left">
            <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest text-left">CSVインポート</h3>
            <div className="space-y-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className={`w-full rounded-lg border py-3 font-medium transition-colors ${
                  isImporting
                    ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {isImporting ? 'インポート中...' : '単語CSVを選択'}
              </button>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
              <button
                onClick={() => minimalPairInputRef.current?.click()}
                disabled={isMinimalImporting}
                className={`w-full rounded-lg border py-3 font-medium transition-colors ${
                  isMinimalImporting
                    ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {isMinimalImporting ? 'インポート中...' : '聞き分けCSVを選択'}
              </button>
              <input ref={minimalPairInputRef} type="file" accept=".csv" onChange={handleMinimalPairFileSelect} className="hidden" />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider text-left">バックアップと復元</h2>
        <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-5">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed text-left">
              全データを一つのファイルとして保存・復元できます。機種変更時のデータ移行に最適です。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('share')}
                className="flex-1 py-3 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-100 dark:hover:bg-gray-600 transition shadow-sm flex items-center justify-center gap-2 text-xs"
              >
                <span>📤</span> 外部共有で保存
              </button>
              <button
                onClick={() => handleExport('download')}
                className="flex-1 py-3 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-100 dark:hover:bg-gray-600 transition shadow-sm flex items-center justify-center gap-2 text-xs"
              >
                <span>📁</span> ローカルに保存
              </button>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest text-left">インポート設定</h3>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: IMPORT_MODE.SKIP, label: '重複をスキップして追加', desc: '既存の単語は維持します' },
                { id: IMPORT_MODE.OVERWRITE, label: '既存データを上書き', desc: '綴りが同じ単語を最新版に更新します' },
                { id: IMPORT_MODE.RESTORE, label: 'すべて削除して復元', desc: '全データを消去してファイルを復元します' },
              ].map(mode => (
                <label key={mode.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left ${importMode === mode.id ? 'bg-white dark:bg-gray-800 border-blue-500 ring-1 ring-blue-500' : 'bg-transparent border-gray-200 dark:border-gray-700'}`}>
                  <input
                    type="radio"
                    name="importMode"
                    className="mt-1"
                    checked={importMode === mode.id}
                    onChange={() => setImportMode(mode.id)}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{mode.label}</p>
                    <p className="text-[10px] text-gray-500">{mode.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={() => backupInputRef.current?.click()}
              disabled={isBackupProcessing}
              className="w-full py-3 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-100 dark:hover:bg-gray-600 transition shadow-sm flex items-center justify-center gap-2"
            >
              {isBackupProcessing ? (
                <div className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full"></div>
              ) : (
                <><span>📥</span> バックアップからインポート</>
              )}
            </button>
            <input ref={backupInputRef} type="file" accept=".json" onChange={handleBackupSelect} className="hidden" />
            {backupStatus?.success && (
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold animate-in fade-in zoom-in-95 text-left">
                完了: 単語{backupStatus.wordCount}件、聞き分けセット{backupStatus.pairCount}件を処理しました。
              </div>
            )}
            {backupStatus?.error && (
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold text-left">
                エラー: {backupStatus.error}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="pt-6 border-t border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">ライセンス情報</h2>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-[10px] text-gray-400 dark:text-gray-500 space-y-4 leading-relaxed">
          <div className="space-y-1">
            <p className="text-gray-500 dark:text-gray-400 text-left">Copyright © 2026 Yuuki Sakano (@yukisku) All Rights Reserved.</p>
            <p className="whitespace-pre-wrap text-left">
              本ソフトウェアおよび関連する文書のファイル（以下「ソフトウェア」）の複製を取得した全ての人物に対し、以下の条件に従うことを前提に、ソフトウェアを無制限に扱うことを無償で許可します。これには、ソフトウェアの複製を使用、複製、改変、結合、公開、頒布、再許諾、および/または販売する権利、およびソフトウェアを提供する人物に同様の行為を許可する権利が含まれますが、これらに限定されません。
              {"\n\n"}
              上記の著作権表示および本許諾表示を、ソフトウェアの全ての複製または実質的な部分に記載するものとします。
              {"\n\n"}
              ソフトウェアは「現状有姿」で提供され、商品性、特定目的への適合性、および権利の非侵害性に関する保証を含むがこれらに限定されず、明示的であるか黙示的であるかを問わず、いかなる種類の保証も行われません。著作者または著作権者は、契約、不法行為、またはその他の行為であるかを問わず、ソフトウェアまたはソフトウェアの使用もしくはその他に取り扱いに起因または関連して生じるいかなる請求、損害賠償、その他の責任について、一切の責任を負いません。
            </p>
          </div>
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <p className="font-bold text-gray-500 dark:text-gray-400 text-left">サードパーティ・ライセンス</p>
            <p className="text-left">本アプリは以下のオープンソースソフトウェアを使用しています。</p>
            <div className="space-y-1 text-left">
              <p className="font-semibold">[MIT License]</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>React: Copyright © Meta Platforms, Inc.</li>
                <li>Capacitor: Copyright © Ionic</li>
                <li>capacitor-native-settings: Copyright © Robin Genz</li>
                <li>@capacitor-community/sqlite: Copyright © Capacitor Community</li>
                <li>@capacitor-community/text-to-speech: Copyright © Capacitor Community</li>
                <li>@capacitor/share: Copyright © Ionic</li>
                <li>@capacitor/filesystem: Copyright © Ionic</li>
                <li>Tailwind CSS: Copyright © Tailwind Labs, Inc.</li>
                <li>Vite: Copyright © Evan You and Vite contributors</li>
                <li>TanStack Query: Copyright © TanStack</li>
                <li>react-intersection-observer: Copyright © Maurits Meester</li>
              </ul>
            </div>
            <div className="space-y-1 pt-1 text-left">
              <p className="font-semibold">[Apache License 2.0]</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>AndroidX Libraries: Copyright © The Android Open Source Project</li>
                <li>Google Play Services: Copyright © Google LLC</li>
              </ul>
              <p className="mt-1 opacity-80 text-left">
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

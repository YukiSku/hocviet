import { Preferences } from '@capacitor/preferences';
import { parseCsv } from './csv';
import { importWordsFromCsv, importMinimalPairsFromCsv } from './db';

const VOCAB_IMPORT_KEY = 'initial_vocab_imported_v1';
const MINIMAL_IMPORT_KEY = 'initial_minimal_imported_v1';

/**
 * アプリの初回起動時にサンプルデータをインポートする
 */
export async function loadInitialDataIfFirstTime() {
  // 1. 単語リストのインポート
  const { value: vocabDone } = await Preferences.get({ key: VOCAB_IMPORT_KEY });
  if (vocabDone !== 'true') {
    try {
      const resp = await fetch('/sample_data/vocabulary_extended.csv');
      if (resp.ok) {
        const text = await resp.text();
        await importWordsFromCsv(parseCsv(text));
        await Preferences.set({ key: VOCAB_IMPORT_KEY, value: 'true' });
        console.log('Imported vocabulary samples');
      }
    } catch (e) {
      console.error('Failed to import vocabulary samples:', e);
    }
  }

  // 2. ミニマルペアのインポート
  const { value: minimalDone } = await Preferences.get({ key: MINIMAL_IMPORT_KEY });
  if (minimalDone !== 'true') {
    try {
      const resp = await fetch('/sample_data/minimal_pairs.csv');
      if (resp.ok) {
        const text = await resp.text();
        await importMinimalPairsFromCsv(parseCsv(text));
        await Preferences.set({ key: MINIMAL_IMPORT_KEY, value: 'true' });
        console.log('Imported minimal pair samples');
      }
    } catch (e) {
      console.error('Failed to import minimal pair samples:', e);
    }
  }
}

import { Preferences } from '@capacitor/preferences';
import { parseCsv } from './csv';
import { importWordsFromCsv, importMinimalPairsFromCsv } from './db';

const VOCAB_IMPORT_KEY = 'initial_vocab_imported_v2';
const MINIMAL_IMPORT_KEY = 'initial_minimal_imported_v2';

/**
 * 単語リストのサンプルを読み込む
 */
export async function loadSampleVocabulary() {
  const file = '/sample_data/vocabulary_basic.csv';
  try {
    const resp = await fetch(file);
    if (!resp.ok) throw new Error('File not found');
    const text = await resp.text();
    const count = await importWordsFromCsv(parseCsv(text));
    return count;
  } catch (e) {
    console.error(`Failed to import sample vocabulary:`, e);
    throw e;
  }
}

/**
 * ミニマルペアのサンプルを読み込む
 */
export async function loadSampleMinimalPairs() {
  const file = '/sample_data/minimal_pairs.csv';
  try {
    const resp = await fetch(file);
    if (!resp.ok) throw new Error('File not found');
    const text = await resp.text();
    const count = await importMinimalPairsFromCsv(parseCsv(text));
    return count;
  } catch (e) {
    console.error(`Failed to import sample minimal pairs:`, e);
    throw e;
  }
}

/**
 * アプリの初回起動時にサンプルデータをインポートする
 */
export async function loadInitialDataIfFirstTime() {
  // 1. 単語リスト
  const { value: vocabDone } = await Preferences.get({ key: VOCAB_IMPORT_KEY });
  if (vocabDone !== 'true') {
    try {
      await loadSampleVocabulary();
      await Preferences.set({ key: VOCAB_IMPORT_KEY, value: 'true' });
    } catch (e) { /* ignore */ }
  }

  // 2. ミニマルペア
  const { value: minimalDone } = await Preferences.get({ key: MINIMAL_IMPORT_KEY });
  if (minimalDone !== 'true') {
    try {
      await loadSampleMinimalPairs();
      await Preferences.set({ key: MINIMAL_IMPORT_KEY, value: 'true' });
    } catch (e) { /* ignore */ }
  }
}

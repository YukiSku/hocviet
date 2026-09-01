import { Preferences } from '@capacitor/preferences';

const THEME_KEY = 'theme'; // 'light' | 'dark' | 'system'

export async function getTheme() {
  const { value } = await Preferences.get({ key: THEME_KEY });
  return value ?? 'system';
}

export async function setTheme(theme) {
  await Preferences.set({ key: THEME_KEY, value: theme });
}
import { TextToSpeech } from '@capacitor-community/text-to-speech';

/**
 * ベトナム語のTTS（音声合成）を利用するためのカスタムフック
 */
export function useTTS() {
  const speak = async (text, rate = 0.9) => {
    if (!text) return;

    // 複数のスペルがある場合は最初のものを採用
    const textToSpeak = text.split(/[;；,，]/)[0].trim();

    try {
      await TextToSpeech.speak({
        text: textToSpeak,
        lang: 'vi-VN',
        rate: rate,
        pitch: 1.0,
        volume: 1.0,
      });
    } catch (e) {
      console.error('TTS error:', e);
      // エラー時はコンソールのみ（UIを邪魔しないため）
    }
  };

  return { speak };
}

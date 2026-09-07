import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { useState, useCallback } from 'react';

/**
 * ベトナム語のTTS（音声合成）を利用するためのカスタムフック
 */
export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(async (text, rate = 0.9) => {
    if (!text) return;

    // 前の音声を停止
    try {
      await TextToSpeech.stop();
    } catch (e) { /* ignore */ }

    // 複数のスペルがある場合は最初のものを採用
    const textToSpeak = text.split(/[;；,，]/)[0].trim();

    try {
      setIsSpeaking(true);
      await TextToSpeech.speak({
        text: textToSpeak,
        lang: 'vi-VN',
        rate: rate,
        pitch: 1.0,
        volume: 1.0,
      });
    } catch (e) {
      console.error('TTS error:', e);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await TextToSpeech.stop();
    } catch (e) { /* ignore */ }
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}

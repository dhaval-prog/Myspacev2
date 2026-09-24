import { useCallback, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule as RawSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

// The package ships separate native/.web `.d.ts` files for this module (mirroring its separate
// native/web implementations); this project's `moduleSuffixes` (which lets our own *.native.tsx
// / *.web.tsx pairs resolve per-platform for the bundler) makes plain `tsc` pick the `.web`
// declaration for every platform when type-checking, and that one's `start`/`stop`/
// `requestPermissionsAsync` end up typed as static-only. The real runtime export has all three
// on every platform (confirmed against both declaration files) — this local interface plus cast
// sidesteps the mismatched declaration rather than fighting the whole project's module
// resolution over one dependency.
interface SpeechRecognitionModule {
  start(options: { lang?: string; interimResults?: boolean; continuous?: boolean; addsPunctuation?: boolean }): void;
  stop(): void;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
}

const ExpoSpeechRecognitionModule = RawSpeechRecognitionModule as unknown as SpeechRecognitionModule;

interface UseVoiceToTextOptions {
  /** Called with each finalized chunk of speech as it's recognized. */
  onFinalText: (text: string) => void;
}

interface UseVoiceToTextResult {
  recording: boolean;
  /** The current not-yet-final transcript, for a live "as you speak" preview. */
  interimText: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Wraps expo-speech-recognition — the native iOS/Android speech recognizer, and the Web Speech
 * API on web, behind one surface — into a small start/stop + live-transcript hook for the
 * letter's voice-to-text button. Permission is requested fresh on every `start()` call (the
 * module itself no-ops a repeat prompt once the user has already answered).
 */
export function useVoiceToText({ onFinalText }: UseVoiceToTextOptions): UseVoiceToTextResult {
  const [recording, setRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const onFinalTextRef = useRef(onFinalText);
  onFinalTextRef.current = onFinalText;

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      setInterimText('');
      if (transcript.trim()) onFinalTextRef.current(transcript.trim());
    } else {
      setInterimText(transcript);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setRecording(false);
    setInterimText('');
    if (event.error === 'no-speech') return; // nothing said — not worth surfacing as an error
    setError(
      event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone access is needed to speak your letter.'
        : "Couldn't hear that. Try again.",
    );
  });

  useSpeechRecognitionEvent('end', () => {
    setRecording(false);
    setInterimText('');
  });

  const start = useCallback(async () => {
    setError(null);
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone access is needed to speak your letter.');
      return;
    }
    setRecording(true);
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true, addsPunctuation: true });
  }, []);

  const stop = useCallback(() => {
    // Flip the UI back immediately rather than waiting on the module's own 'end' event — on some
    // devices/browsers that event doesn't reliably fire promptly (or at all) once `continuous`
    // recognition is running, which made the stop button look broken (recording state stuck
    // true forever). A late 'result' event for whatever was already said can still arrive and
    // append normally — the `result` handler above doesn't gate on `recording` — so nothing said
    // right before stopping is lost, it just doesn't wait around for it.
    setRecording(false);
    setInterimText('');
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { recording, interimText, error, start, stop };
}

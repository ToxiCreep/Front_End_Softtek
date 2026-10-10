import { useEffect, useRef, useState } from 'react';
import { createVoiceInput, type VoiceOptions } from '../browser/voice.js';

export function useVoiceInput(options: VoiceOptions) {
  const callbacks = useRef(options);
  callbacks.current = options;
  const instance = useRef<ReturnType<typeof createVoiceInput> | undefined>(undefined);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    const voice = createVoiceInput({
      lang: options.lang, recognition: options.recognition,
      onFinal: text => { if (mounted) callbacks.current.onFinal(text); },
      onTranscript: text => {
        if (mounted) { setTranscript(text); callbacks.current.onTranscript?.(text); }
      },
      onListening: value => { if (mounted) setListening(value); },
      onError: message => { if (mounted) { setError(message); callbacks.current.onError?.(message); } }
    });
    instance.current = voice;
    setSupported(voice.supported);
    return () => { mounted = false; voice.dispose(); };
  }, [options.lang, options.recognition]);
  return {
    supported, listening, transcript, error,
    start: () => { setError(null); setTranscript(''); instance.current?.start(); },
    stop: () => instance.current?.stop(),
    cancel: () => instance.current?.cancel()
  };
}

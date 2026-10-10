/** Tipos mínimos de Web Speech: funciona también con el prefijo webkit. */
export interface SpeechResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
export interface SpeechRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type SpeechRecognizerConstructor = new () => SpeechRecognizer;
export interface VoiceOptions {
  lang?: string;
  onTranscript?: (text: string) => void;
  /** Se llama una vez al acabar la frase, nunca para resultados provisionales. */
  onFinal: (text: string) => void;
  onListening?: (listening: boolean) => void;
  onError?: (message: string) => void;
  recognition?: SpeechRecognizerConstructor;
}
function nativeRecognition(): SpeechRecognizerConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognizerConstructor;
    webkitSpeechRecognition?: SpeechRecognizerConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}
const errorMessages: Record<string, string> = {
  'not-allowed': 'Permite el acceso al micrófono para dictar.',
  'service-not-allowed': 'Este navegador no permite dictar. Abre esta misma página en Chrome o Safari y permite el micrófono.',
  'audio-capture': 'No se pudo acceder al micrófono.',
  'no-speech': 'No se detectó voz. Vuelve a dictar.',
  network: 'No se pudo conectar con el dictado del navegador. Abre esta misma página en Chrome o Safari, con conexión a internet, y permite el micrófono.',
  aborted: 'Se canceló el dictado.'
};
export function createVoiceInput(options: VoiceOptions) {
  const Constructor = options.recognition ?? nativeRecognition();
  let active: SpeechRecognizer | undefined;
  let finalText = '';
  function cancel() {
    const previous = active;
    active = undefined;
    finalText = '';
    if (previous) {
      previous.onend = null;
      previous.onresult = null;
      previous.onerror = null;
      previous.abort();
    }
    options.onListening?.(false);
  }
  return {
    supported: Boolean(Constructor),
    start() {
      if (active) return;
      if (!Constructor) {
        options.onError?.('Este navegador no ofrece reconocimiento de voz. Puedes escribir tu solicitud.');
        return;
      }
      const recognition = new Constructor();
      active = recognition;
      finalText = '';
      recognition.lang = options.lang ?? 'es-MX';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = event => {
        if (active !== recognition) return;
        const results = Array.from(event.results);
        finalText = results.filter(result => result.isFinal).map(result => result[0].transcript).join(' ').trim();
        options.onTranscript?.(results.map(result => result[0].transcript).join(' ').trim());
      };
      recognition.onerror = event => {
        if (active !== recognition) return;
        cancel();
        options.onError?.(errorMessages[event.error] ?? `No se pudo transcribir la voz (${event.error}).`);
      };
      recognition.onend = () => {
        if (active !== recognition) return;
        active = undefined;
        options.onListening?.(false);
        const text = finalText;
        finalText = '';
        if (text) options.onFinal(text);
      };
      try {
        options.onListening?.(true);
        recognition.start();
      } catch (error) {
        cancel();
        options.onError?.(error instanceof Error ? error.message : 'No se pudo iniciar el dictado.');
      }
    },
    stop() { active?.stop(); },
    cancel,
    dispose: cancel
  };
}

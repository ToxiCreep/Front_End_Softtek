import { expect, it, vi } from 'vitest';
import { createVoiceInput } from '../src/browser/voice.js';
import { FakeRecognition } from './fakeRecognition.js';
it('transcribes interim text and submits a final utterance once when recognition ends', () => {
  const onFinal = vi.fn(); const onTranscript = vi.fn();
  const voice = createVoiceInput({ recognition: FakeRecognition, onFinal, onTranscript });
  voice.start(); const recognition = FakeRecognition.current;
  expect(recognition.lang).toBe('es-MX');
  recognition.result('Crea una', false); expect(onFinal).not.toHaveBeenCalled();
  recognition.result('Crea una lista de tareas', true); expect(onFinal).not.toHaveBeenCalled();
  recognition.onend?.(); recognition.onend?.();
  expect(onFinal).toHaveBeenCalledExactlyOnceWith('Crea una lista de tareas');
  expect(onTranscript).toHaveBeenCalledWith('Crea una');
});
it('does not submit cancelled speech or a transcript followed by a microphone error', () => {
  const onFinal = vi.fn(); const onError = vi.fn();
  const voice = createVoiceInput({ recognition: FakeRecognition, onFinal, onError });
  voice.start(); let recognition = FakeRecognition.current;
  recognition.result('Cancela esto', true);
  const staleEnd = recognition.onend;
  voice.cancel(); staleEnd?.(); expect(recognition.abort).toHaveBeenCalledOnce();
  expect(onFinal).not.toHaveBeenCalled();
  voice.start(); recognition = FakeRecognition.current;
  recognition.result('No enviar', true); recognition.onerror?.({ error: 'not-allowed' }); recognition.onend?.();
  expect(onError).toHaveBeenCalledWith('Permite el acceso al micrófono para dictar.');
  expect(onFinal).not.toHaveBeenCalled();
});
it('handles a missing browser recognizer without requiring a DOM on the server', () => {
  const onError = vi.fn();
  const voice = createVoiceInput({ onFinal: vi.fn(), onError });
  expect(voice.supported).toBe(false); voice.start(); expect(onError).toHaveBeenCalledOnce();
});
it('releases a failed recognizer even when the browser never fires end, allowing a fresh dictation', () => {
  const onFinal = vi.fn(), onListening = vi.fn(), onError = vi.fn();
  const voice = createVoiceInput({ recognition: FakeRecognition, onFinal, onListening, onError });
  voice.start(); const failed = FakeRecognition.current;
  failed.result('No enviar', true); const staleEnd = failed.onend;
  failed.onerror?.({ error: 'network' });
  expect(onListening).toHaveBeenLastCalledWith(false);
  expect(failed.abort).toHaveBeenCalledOnce();
  expect(onError).toHaveBeenCalledWith(expect.stringContaining('Chrome o Safari'));
  staleEnd?.(); expect(onFinal).not.toHaveBeenCalled();
  voice.start(); const fresh = FakeRecognition.current;
  expect(fresh).not.toBe(failed);
  fresh.result('Consulta existencias', true); fresh.onend?.();
  expect(onFinal).toHaveBeenCalledExactlyOnceWith('Consulta existencias');
});

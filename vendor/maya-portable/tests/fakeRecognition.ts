import { vi } from 'vitest';
import type { SpeechRecognizer, SpeechResult } from '../src/browser/voice.js';

export class FakeRecognition implements SpeechRecognizer {
  static current: FakeRecognition;
  lang = ''; continuous = false; interimResults = false;
  onresult: SpeechRecognizer['onresult'] = null;
  onerror: SpeechRecognizer['onerror'] = null;
  onend: SpeechRecognizer['onend'] = null;
  start = vi.fn(); stop = vi.fn(); abort = vi.fn();
  constructor() { FakeRecognition.current = this; }
  result(transcript: string, isFinal: boolean) {
    const result: SpeechResult = { 0: { transcript }, isFinal };
    this.onresult?.({ results: [result] });
  }
}

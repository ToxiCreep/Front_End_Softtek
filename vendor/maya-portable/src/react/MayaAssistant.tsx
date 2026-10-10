import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createMayaClient, MayaHttpError, type MayaClient } from '../browser/client.js';
import type { A2UIScreen, HistoryItem, MayaAction, MayaRequest } from '../core/types.js';
import { A2UIRenderer, type A2UIRendererProps } from './A2UIRenderer.js';
import { useVoiceInput } from './useVoiceInput.js';

export interface MayaAssistantProps {
  client?: MayaClient;
  endpoint?: string;
  context?: Record<string, unknown>;
  name?: string;
  lang?: string;
  components?: A2UIRendererProps['components'];
  onScreen?: (screen: A2UIScreen) => void;
}
export function MayaAssistant({ client: suppliedClient, endpoint, context, name = 'Maya',
  lang = 'es-MX', components, onScreen }: MayaAssistantProps) {
  const client = useMemo(() => suppliedClient ?? createMayaClient({ endpoint }), [suppliedClient, endpoint]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [screen, setScreen] = useState<A2UIScreen | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const controller = useRef<AbortController | undefined>(undefined);
  const messagesEnd = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { messagesEnd.current?.scrollIntoView?.({ block: 'nearest' }); }, [history]);
  async function send(message: string, action?: MayaAction) {
    if (busy.current || !message.trim()) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    const request: MayaRequest = { message, context, history, action, screen: screen ?? undefined };
    setHistory(current => [...current, { role: 'user', content: message }]);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await client.process(request, abort.signal);
      if (abort.signal.aborted) return;
      setScreen(response);
      setHistory(current => [...current, { role: 'assistant', content: response.assistantMessage }]);
      onScreen?.(response);
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure instanceof MayaHttpError && failure.actionMayHaveRun
        ? 'La acción pudo ejecutarse. Revisa el resultado en tu programa antes de repetirla.'
        : failure instanceof Error ? failure.message : 'No se pudo generar la interfaz.');
    } finally {
      busy.current = false;
      if (!abort.signal.aborted) setLoading(false);
    }
  }
  const voice = useVoiceInput({ lang, onTranscript: setInput,
    onFinal: text => { setInput(''); void send(text); } });
  const act = (action: MayaAction) => {
    if (action.type === 'USER_PROMPT') void send(String(action.payload?.text ?? ''));
    else void send(`Acción: ${action.type}`, action);
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || busy.current || voice.listening) return;
    void send(input.trim());
    setInput('');
  }
  return <div className="maya-assistant">
    <section className="maya-canvas" aria-label="Interfaz generada">
      {screen ? <A2UIRenderer key={screen.screenId} screen={screen} onAction={act} loading={loading || voice.listening}
        components={components} /> : <p className="maya-empty">Describe la interfaz que necesitas, por texto o voz.</p>}
      {screen?.suggestedPrompts?.length ? <div className="maya-suggestions">
        {screen.suggestedPrompts.map((prompt, i) => <button type="button" key={i} disabled={loading || voice.listening}
          onClick={() => void send(prompt)}>{prompt}</button>)}</div> : null}
    </section>
    <aside className="maya-chat" aria-label={`Conversación con ${name}`}>
      <h2>{name}</h2><div className="maya-messages" role="log" aria-live="polite">
        {history.map((item, i) => <div key={i} data-role={item.role}><small>{item.role === 'user' ? 'Tú' : name}</small>
          <p>{item.content}</p></div>)}<div ref={messagesEnd} /></div>
      {loading ? <p role="status">Preparando la interfaz…</p> : null}
      {error || voice.error ? <p role="alert" className="maya-error">{error ?? voice.error}</p> : null}
      <form onSubmit={submit}><label>Tu solicitud<textarea value={input} onChange={event => setInput(event.target.value)}
        disabled={loading || voice.listening} placeholder="Describe qué necesitas…" /></label>
        <div className="maya-actions"><button type="submit" disabled={loading || voice.listening || !input.trim()}>Enviar</button>
          <button type="button" disabled={!voice.supported || loading} onClick={voice.listening ? voice.stop : voice.start}>
            {voice.listening ? 'Terminar dictado' : 'Dictar por voz'}</button>
          {voice.listening ? <button type="button" onClick={voice.cancel}>Cancelar dictado</button> : null}</div>
        {!voice.supported ? <small className="maya-muted">La voz no está disponible en este navegador.</small> : null}
      </form>
    </aside>
  </div>;
}

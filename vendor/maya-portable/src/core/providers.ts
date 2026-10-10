import type { ModelProvider, ModelRequest } from './types.js';

interface HttpOptions {
  host?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}
export class ProviderHttpError extends Error {
  constructor(public readonly status: number) { super(`El proveedor respondió HTTP ${status}`); }
}
async function postJson(url: string, headers: Record<string, string>, body: unknown,
  request: ModelRequest, options: HttpOptions): Promise<Record<string, any>> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 30_000);
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
  const response = await (options.fetch ?? globalThis.fetch)(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body), signal
  });
  // No incluir cabeceras, claves ni cuerpos del proveedor en los errores HTTP.
  if (!response.ok) throw new ProviderHttpError(response.status);
  return response.json();
}
export interface OllamaOptions extends HttpOptions {
  model: string;
  planningModel?: string;
  apiKey?: string;
}
export function createOllamaProvider(options: OllamaOptions): ModelProvider {
  const host = (options.host ?? 'https://ollama.com').replace(/\/+$/, '');
  const cloud = new URL(host).hostname === 'ollama.com';
  return {
    async generate(request) {
      if (cloud && !options.apiKey) {
        throw new Error('Configura OLLAMA_API_KEY o usa Ollama local');
      }
      const data = await postJson(`${host}/api/chat`, options.apiKey
        ? { Authorization: `Bearer ${options.apiKey}` } : {}, {
        model: request.purpose === 'plan' ? options.planningModel ?? options.model : options.model,
        messages: request.messages, stream: false,
        // Cloud no admite esquemas; el motor valida el JSON y conserva las reglas del catálogo.
        ...(cloud ? { think: false, options: { temperature: request.temperature } }
          : { format: request.responseSchema ?? 'json', keep_alive: '30m', options: { temperature: request.temperature, num_ctx: 8192 } })
      }, request, options);
      const content = data.message?.content ?? data.response;
      if (typeof content !== 'string' || !content.trim()) throw new Error('Ollama devolvió una respuesta vacía');
      return content;
    }
  };
}
export interface GeminiOptions extends HttpOptions { model: string; apiKey: string }
/** REST: conserva Gemini sin acoplar el motor al SDK antiguo del proyecto. */
export function createGeminiProvider(options: GeminiOptions): ModelProvider {
  const host = (options.host ?? 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  return {
    async generate(request) {
      if (!options.apiKey) throw new Error('Configura GEMINI_API_KEY');
      const system = request.messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
      const data = await postJson(`${host}/v1beta/models/${encodeURIComponent(options.model)}:generateContent`,
        { 'x-goog-api-key': options.apiKey }, {
          systemInstruction: { parts: [{ text: system }] },
          contents: request.messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }]
          })),
          generationConfig: { responseMimeType: 'application/json', temperature: request.temperature }
        }, request, options);
      const content = data.candidates?.[0]?.content?.parts?.filter((part: any) => !part.thought)
        .map((part: any) => part.text ?? '').join('');
      if (typeof content !== 'string' || !content.trim()) throw new Error('Gemini devolvió una respuesta vacía');
      return content;
    }
  };
}

import { isRecord, normalizeA2UIScreen } from '../core/protocol.js';
import type { A2UIScreen, MayaRequest } from '../core/types.js';

export interface MayaClient {
  process(request: MayaRequest, signal?: AbortSignal): Promise<A2UIScreen>;
}
export class MayaHttpError extends Error {
  constructor(message: string, public readonly status: number, public readonly actionMayHaveRun: boolean) {
    super(message);
    this.name = 'MayaHttpError';
  }
}
export async function readMayaResponse<T>(response: Response, actionMayHaveRun = false): Promise<T> {
  let body: unknown;
  try { body = await response.json(); }
  catch {
    throw new MayaHttpError('El servidor no devolvió una respuesta válida. Intenta de nuevo en un momento.', response.status, actionMayHaveRun);
  }
  if (!response.ok) throw new MayaHttpError(isRecord(body) && typeof body.error === 'string' ? body.error : 'No se pudo obtener la interfaz.', response.status,
    isRecord(body) && typeof body.actionMayHaveRun === 'boolean' ? body.actionMayHaveRun : actionMayHaveRun);
  return body as T;
}
export function createMayaClient(options: { endpoint?: string; fetch?: typeof globalThis.fetch } = {}): MayaClient {
  return {
    async process(request, signal) {
      const response = await (options.fetch ?? globalThis.fetch)(options.endpoint ?? '/api/maya/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request), signal
      });
      const body = await readMayaResponse(response, Boolean(request.action));
      return normalizeA2UIScreen(body);
    }
  };
}

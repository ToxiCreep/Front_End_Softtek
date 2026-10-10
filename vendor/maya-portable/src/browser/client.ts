import { normalizeA2UIScreen } from '../core/protocol.js';
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
export function createMayaClient(options: { endpoint?: string; fetch?: typeof globalThis.fetch } = {}): MayaClient {
  return {
    async process(request, signal) {
      const response = await (options.fetch ?? globalThis.fetch)(options.endpoint ?? '/api/maya/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request), signal
      });
      const body = await response.json();
      if (!response.ok) throw new MayaHttpError(body.error ?? 'No se pudo obtener la interfaz', response.status,
        body.actionMayHaveRun === true);
      return normalizeA2UIScreen(body);
    }
  };
}

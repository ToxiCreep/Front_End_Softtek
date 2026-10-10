import express from 'express';
import { MayaError, type Maya } from '../core/engine.js';
import { isRecord } from '../core/protocol.js';
import type { MayaRequest } from '../core/types.js';

export function validateMayaRequest(body: unknown): asserts body is MayaRequest {
  if (!isRecord(body) || typeof body.message !== 'string') throw new Error('message debe ser texto');
  if (body.context !== undefined && !isRecord(body.context)) throw new Error('context debe ser objeto');
  if (body.history !== undefined && (!Array.isArray(body.history) || body.history.some(item =>
    !isRecord(item) || !['user', 'assistant'].includes(String(item.role)) || typeof item.content !== 'string'))) {
    throw new Error('history debe contener mensajes user/assistant');
  }
  if (body.action !== undefined && (!isRecord(body.action) || typeof body.action.type !== 'string' ||
    !body.action.type.trim() || (body.action.payload !== undefined && !isRecord(body.action.payload)))) {
    throw new Error('action debe tener type y payload opcional de tipo objeto');
  }
  if (body.screen !== undefined && (!isRecord(body.screen) || body.screen.type !== 'a2ui_screen' ||
    !Array.isArray(body.screen.components))) throw new Error('screen debe ser una pantalla A2UI');
}
/** Montar como app.use('/api/maya', createMayaRouter(maya)). */
export function createMayaRouter(maya: Maya) {
  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));
  router.get('/health', (_req, res) => res.json({ status: 'online', service: 'maya-portable' }));
  router.post('/chat', async (req, res) => {
    try { validateMayaRequest(req.body); }
    catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Solicitud inválida' });
      return;
    }
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
      const screen = await maya.process(req.body, controller.signal);
      if (!res.destroyed) res.json(screen);
    } catch (error) {
      if (!res.destroyed) res.status(502).json({
        error: error instanceof MayaError ? error.message : 'No se pudo generar la interfaz',
        stage: error instanceof MayaError ? error.stage : 'screen',
        actionMayHaveRun: error instanceof MayaError && error.actionMayHaveRun
      });
    } finally { res.off('close', cancel); }
  });
  router.use((error: { status?: number; type?: string }, _req: express.Request,
    res: express.Response, next: express.NextFunction) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      res.status(error.status ?? 400).json({ error: 'El cuerpo JSON no es válido o excede el tamaño permitido' });
    } else next(error);
  });
  return router;
}

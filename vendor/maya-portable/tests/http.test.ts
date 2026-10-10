import { afterEach, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createMaya, createOllamaProvider } from '../src/core/index.js';
import { createMayaRouter } from '../src/server/index.js';
import { createMayaClient, readMayaResponse } from '../src/browser/client.js';
import { taskScreen } from './fixtures.js';

const servers: Server[] = [];
async function listen(app: express.Express) {
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve()); server.closeAllConnections();
  })));
});

it('runs client → HTTP → Ollama transport → tools → JSON → action with an isolated model fixture', async () => {
  const modelApp = express(); modelApp.use(express.json());
  const prompts: string[] = []; let queries = 0; let actions = 0;
  modelApp.post('/api/chat', (req, res) => {
    prompts.push(JSON.stringify(req.body.messages));
    const planning = req.body.messages[0].content.includes('Selecciona las herramientas');
    const schema = req.body.format;
    if (schema?.type !== 'object' || (planning
      ? schema.properties?.tools?.items?.oneOf?.[0]?.properties?.name?.const !== 'list_tasks'
      : schema.properties?.type?.const !== 'a2ui_screen')) {
      res.status(400).json({ error: 'Falta el esquema de la respuesta' }); return;
    }
    res.json({ message: { content: JSON.stringify(planning
      ? { intent: 'tareas', tools: [{ name: 'list_tasks', args: {} }] } : taskScreen) } });
  });
  const modelHost = await listen(modelApp);
  const maya = createMaya({ provider: createOllamaProvider({ host: modelHost, model: 'fixture' }),
    systemContext: 'Organizador de tareas del nuevo proyecto',
    tools: [{ name: 'list_tasks', description: 'Lista tareas', inputSchema: {},
      execute: () => { queries++; return [{ id: 'task-1' }]; } }],
    onAction: () => { actions++; return { completed: true }; }
  });
  const app = express(); app.use('/api/maya', createMayaRouter(maya));
  const host = await listen(app);
  const client = createMayaClient({ endpoint: `${host}/api/maya/chat` });
  const screen = await client.process({ message: 'Quiero una lista de tareas' });
  expect(screen).toEqual(taskScreen);
  expect(await client.process({ message: 'Completar tarea', screen,
    action: { type: 'COMPLETE_TASK', payload: { taskId: 'task-1' } } })).toEqual(taskScreen);
  expect(queries).toBe(2); expect(actions).toBe(1); expect(prompts).toHaveLength(4);
  expect(prompts.join(' ')).toContain('Organizador de tareas');
  expect(prompts.join(' ')).not.toContain('Banorte');
  expect((await fetch(`${host}/api/maya/health`)).status).toBe(200);
  expect((await fetch(`${host}/api/maya/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: '{"message":3}' })).status).toBe(400);
  expect((await fetch(`${host}/api/maya/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: '{invalid' })).status).toBe(400);
});

it('returns a structured error when model generation fails after an action', async () => {
  let actions = 0;
  const app = express(); app.use('/api/maya', createMayaRouter(createMaya({ maxAttempts: 1,
    provider: { generate: async () => { throw new Error('secret transport detail'); } },
    onAction: () => { actions++; return 'done'; }
  })));
  const host = await listen(app);
  await expect(createMayaClient({ endpoint: `${host}/api/maya/chat` }).process({ message: 'Acción', action: { type: 'CUSTOM' } }))
    .rejects.toMatchObject({ status: 502, actionMayHaveRun: true });
  expect(actions).toBe(1);
});

it.each([
  [405, ''],
  [200, '<!doctype html><html>SPA fallback</html>'],
  [504, '{"error":'],
])('reports a readable HTTP error for status %i with an invalid JSON body', async (status, body) => {
  const client = createMayaClient({ fetch: async () => new Response(body, { status }) });
  await expect(client.process({ message: 'Consultar' })).rejects.toMatchObject({
    name: 'MayaHttpError', status, actionMayHaveRun: false,
    message: 'El servidor no devolvió una respuesta válida. Intenta de nuevo en un momento.',
  });
});

it('preserves uncertain writes and explicit server rejections when parsing responses', async () => {
  await expect(createMayaClient({ fetch: async () => new Response('', { status: 504 }) })
    .process({ message: 'Guardar', action: { type: 'ADD_STOCK' } })).rejects.toMatchObject({ actionMayHaveRun: true });
  await expect(readMayaResponse(new Response(JSON.stringify({ error: 'Stock insuficiente', actionMayHaveRun: false }), { status: 422 }), true))
    .rejects.toMatchObject({ message: 'Stock insuficiente', status: 422, actionMayHaveRun: false });
  await expect(readMayaResponse(new Response('', { status: 405 }))).rejects.toMatchObject({ actionMayHaveRun: false });
});

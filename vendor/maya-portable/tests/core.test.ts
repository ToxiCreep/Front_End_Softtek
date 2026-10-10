import { expect, it, vi } from 'vitest';
import { createMaya, DEFAULT_CATALOG, MayaError, normalizeA2UIScreen, parseModelJson,
  createOllamaProvider, createGeminiProvider } from '../src/core/index.js';
import type { ModelRequest } from '../src/core/types.js';
import { taskScreen } from './fixtures.js';
import { ProviderHttpError } from '../src/core/providers.js';

it('normalizes nested components and direct props without banking data or minimum layout', () => {
  const screen = normalizeA2UIScreen({ a2ui_screen: {
    screenType: 'simple', components: [{ component: 'Card', title: 'Notas', children: [
      { type: 'Text', content: 'Una, } cadena válida' }
    ] }]
  } }, DEFAULT_CATALOG.map(c => c.type));
  expect(screen.components).toHaveLength(1);
  expect(screen.components[0].props.title).toBe('Notas');
  expect(screen.components[0].children?.[0].props.content).toBe('Una, } cadena válida');
  expect(screen.components[0].children?.[0].id).not.toBe(screen.components[0].id);
  expect(parseModelJson('```json\n{"content":"texto, } intacto"}\n```')).toEqual({ content: 'texto, } intacto' });
  expect(normalizeA2UIScreen({ components: [] }).components).toEqual([]);
});

it('passes host context, history and previous screen and accepts custom components/actions', async () => {
  const generate = vi.fn(async (_request: ModelRequest) => JSON.stringify({ ...taskScreen,
    components: [{ id: 'new', type: 'TaskBoard', props: { items: [] } }] }));
  const maya = createMaya({ provider: { generate }, systemContext: request => `Dominio: ${request.context?.domain}`,
    catalog: [...DEFAULT_CATALOG, { type: 'TaskBoard', description: 'Tablero propio', props: 'items' }] });
  const history = Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, content: `Mensaje ${i}` }));
  const screen = await maya.process({ message: 'Haz un tablero', context: { domain: 'tareas' }, history, screen: taskScreen });
  expect(screen.components[0].type).toBe('TaskBoard');
  const messages = generate.mock.calls[0][0].messages;
  expect(messages).toHaveLength(12);
  expect(messages[0].content).toContain('Dominio: tareas');
  expect(messages[0].content).not.toMatch(/Banorte|usr_carlos|MÍNIMO 4|PAY_CARD/);
  expect(JSON.parse(messages.at(-1)!.content).previousScreen).toEqual(taskScreen);
});

it('repairs invalid output while executing tools and the host action once', async () => {
  let screens = 0;
  const generate = vi.fn(async (request: ModelRequest) => {
    if (request.purpose === 'plan') return JSON.stringify({ intent: 'tareas', tools: [{ name: 'list_tasks', args: {} }] });
    screens++;
    return screens === 1 ? 'respuesta rota' : JSON.stringify(taskScreen);
  });
  const execute = vi.fn(async () => [{ id: 'task-1', title: 'Diseño' }]);
  const onAction = vi.fn(async () => ({ completed: true }));
  const maya = createMaya({ provider: { generate }, maxAttempts: 2, onAction,
    tools: [{ name: 'list_tasks', description: 'Consulta tareas', inputSchema: { type: 'object' }, execute }] });
  expect(await maya.process({ message: 'Completar', action: { type: 'COMPLETE_TASK', payload: { taskId: 'task-1' } } })).toEqual(taskScreen);
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(generate).toHaveBeenCalledTimes(3);
  expect(generate.mock.calls[2][0].messages.at(-1)!.content).toContain('Repara');
  expect(generate.mock.calls[1][0].messages.at(-1)!.content).toContain('completed');
});

it('rejects an unregistered tool before invoking any tool', async () => {
  const execute = vi.fn();
  const maya = createMaya({ maxAttempts: 1, provider: { generate: async () =>
    '{"tools":[{"name":"unknown","args":{}}]}' },
    tools: [{ name: 'list_tasks', description: 'Tareas', inputSchema: {}, execute }] });
  await expect(maya.process({ message: 'Consultar' })).rejects.toMatchObject({ stage: 'plan' });
  expect(execute).not.toHaveBeenCalled();
});
it('lets the host reject a plan before actions, tools or screen generation', async () => {
  const generate = vi.fn(async () => '{"intent":"outside","tools":[{"name":"list_tasks","args":{}}]}');
  const execute = vi.fn(), onAction = vi.fn();
  const maya = createMaya({provider:{generate},onAction,onPlan:()=>taskScreen,
    tools:[{name:'list_tasks',description:'Tareas',inputSchema:{},execute}]});
  expect(await maya.process({message:'Otra tarea',action:{type:'COMPLETE_TASK'}})).toEqual(taskScreen);
  expect(generate).toHaveBeenCalledOnce(); expect(execute).not.toHaveBeenCalled(); expect(onAction).not.toHaveBeenCalled();
});
it('runs an approved action and tools once even when screen generation requires a repair', async () => {
  let screens=0;
  const generate=vi.fn(async (request:ModelRequest)=>request.purpose==='plan' ? '{"intent":"tasks","tools":[{"name":"list_tasks","args":{}}]}' : ++screens===1 ? 'invalid' : JSON.stringify(taskScreen));
  const execute=vi.fn(()=>[]), onAction=vi.fn(()=>({saved:true})), onPlan=vi.fn(()=>undefined);
  const maya=createMaya({provider:{generate},onPlan,onAction,maxAttempts:2,tools:[{name:'list_tasks',description:'Tareas',inputSchema:{},execute}]});
  expect(await maya.process({message:'Completar',action:{type:'COMPLETE_TASK'}})).toEqual(taskScreen);
  expect(onPlan).toHaveBeenCalledOnce(); expect(onAction).toHaveBeenCalledOnce(); expect(execute).toHaveBeenCalledOnce();
  expect(generate.mock.calls[0][0].messages.at(-1)!.content).not.toContain('"saved":true');
  expect(generate.mock.calls[1][0].messages.at(-1)!.content).toContain('"saved":true');
});

it('falls back when the primary transport or its JSON fails', async () => {
  const maya = createMaya({ maxAttempts: 1, provider: { generate: async () => { throw new Error('offline'); } },
    fallbackProvider: { generate: async () => JSON.stringify(taskScreen) } });
  expect(await maya.process({ message: 'Lista' })).toEqual(taskScreen);
});

it('reports generation failure after an action without faking success or replaying it', async () => {
  const onAction = vi.fn(() => ({ completed: true }));
  const maya = createMaya({ maxAttempts: 2, onAction, provider: { generate: async () => 'invalid' } });
  await expect(maya.process({ message: 'Completar', action: { type: 'COMPLETE_TASK' } }))
    .rejects.toMatchObject({ name: 'MayaError', stage: 'screen', actionMayHaveRun: true });
  expect(onAction).toHaveBeenCalledTimes(1);
  await expect(createMaya({ provider: { generate: async () => '{}' } })
    .process({ message: 'Acción', action: { type: 'CUSTOM' } })).rejects.toBeInstanceOf(MayaError);
});

it('supports cancellation before calling a provider or host action', async () => {
  const generate = vi.fn(); const onAction = vi.fn();
  const controller = new AbortController(); controller.abort();
  await expect(createMaya({ provider: { generate }, onAction }).process({ message: 'Salir', action: { type: 'CUSTOM' } }, controller.signal)).rejects.toThrow();
  expect(generate).not.toHaveBeenCalled(); expect(onAction).not.toHaveBeenCalled();
});

it('preserves action status when a host result cannot be serialized', async () => {
  const onAction = vi.fn(() => ({ id: 1n }));
  const maya = createMaya({ onAction, provider: { generate: async () => JSON.stringify(taskScreen) } });
  await expect(maya.process({ message: 'Acción', action: { type: 'CUSTOM' } }))
    .rejects.toMatchObject({ stage: 'screen', actionMayHaveRun: true });
  expect(onAction).toHaveBeenCalledOnce();
});

it('validates nested controls but permits arbitrary host action names', () => {
  expect(() => normalizeA2UIScreen({ components: [{ type: 'Card', children: [
    { type: 'ActionButton', props: { label: 'Roto' } }
  ] }] })).toThrow(/actionType/);
  expect(normalizeA2UIScreen(taskScreen).components[0].children?.[1].props.actionType).toBe('COMPLETE_TASK');
});

it('sends Ollama JSON mode, model selection and history through server transport', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ message: { content: JSON.stringify(taskScreen) } })));
  const provider = createOllamaProvider({ host: 'http://localhost:11434/', model: 'screen-model',
    planningModel: 'plan-model', apiKey: 'test-key', fetch: fetcher });
  await provider.generate({ purpose: 'plan', temperature: 0.1, messages: [{ role: 'user', content: 'Consulta' }] });
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe('http://localhost:11434/api/chat');
  expect(JSON.parse(init!.body as string)).toMatchObject({ model: 'plan-model', format: 'json', stream: false, options: { num_ctx: 8192 } });
  expect(init!.headers).toMatchObject({ Authorization: 'Bearer test-key' });
  const responseSchema = { type: 'object', properties: { tools: { type: 'array' } }, required: ['tools'] };
  await provider.generate({ purpose: 'plan', temperature: 0.1, messages: [], responseSchema });
  expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string).format).toEqual(responseSchema);
});

it('maps Gemini system instructions and conversation roles without losing context', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ candidates: [{ content: {
    parts: [{ text: 'internal reasoning', thought: true }, { text: JSON.stringify(taskScreen) }]
  } }] })));
  const provider = createGeminiProvider({ model: 'test-model', apiKey: 'test-key', fetch: fetcher });
  const output = await provider.generate({ purpose: 'screen', temperature: 0.5, messages: [
    { role: 'system', content: 'Contexto propio' }, { role: 'user', content: 'Primera consulta' },
    { role: 'assistant', content: 'Primera respuesta' }, { role: 'user', content: 'Siguiente' }
  ] });
  const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
  expect(body.systemInstruction.parts[0].text).toBe('Contexto propio');
  expect(body.contents.map((item: { role: string }) => item.role)).toEqual(['user', 'model', 'user']);
  expect(body.generationConfig.responseMimeType).toBe('application/json');
  expect(output).toBe(JSON.stringify(taskScreen));
});
it('connects directly to Ollama Cloud without local runtime options or unsupported structured format', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({message:{content:JSON.stringify(taskScreen)}})));
  const provider = createOllamaProvider({host:'https://ollama.com',model:'gemma4:31b',apiKey:'test-key',fetch:fetcher});
  expect(await provider.generate({purpose:'screen',temperature:0.2,messages:[],responseSchema:{type:'object'}})).toBe(JSON.stringify(taskScreen));
  const [url, init] = fetcher.mock.calls[0]; const body = JSON.parse(init!.body as string);
  expect(url).toBe('https://ollama.com/api/chat');
  expect(init!.headers).toMatchObject({Authorization:'Bearer test-key'});
  expect(body).toMatchObject({model:'gemma4:31b',stream:false,think:false});
  expect(body.format).toBeUndefined(); expect(body.keep_alive).toBeUndefined(); expect(body.options.num_ctx).toBeUndefined();
});
it.each([401,403,429])('does not repeat provider failures caused by authentication, access or quota: %s', async status => {
  const generate = vi.fn(async () => {throw new ProviderHttpError(status)});
  await expect(createMaya({provider:{generate},maxAttempts:3}).process({message:'Consulta'})).rejects.toMatchObject({stage:'screen',cause:{status}});
  expect(generate).toHaveBeenCalledOnce();
});

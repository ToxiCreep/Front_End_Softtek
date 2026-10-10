import { DEFAULT_CATALOG, buildScreenPrompt } from './catalog.js';
import { isRecord, normalizeA2UIScreen, parseModelJson } from './protocol.js';
import { ProviderHttpError } from './providers.js';
import type { A2UIScreen, MayaOptions, MayaPlan, MayaRequest, ModelRequest } from './types.js';

export class MayaError extends Error {
  constructor(message: string, public readonly stage: 'plan' | 'action' | 'screen',
    public readonly actionMayHaveRun = false, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MayaError';
  }
}
export function createMaya(options: MayaOptions) {
  const catalog = options.catalog ?? DEFAULT_CATALOG;
  const tools = options.tools ?? [];
  const maxAttempts = options.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('maxAttempts debe ser entero positivo');
  if (new Set(tools.map(t => t.name)).size !== tools.length) throw new Error('Nombres de herramientas duplicados');
  if (new Set(catalog.map(c => c.type)).size !== catalog.length) throw new Error('Tipos de componente duplicados');

  async function generate<T>(request: ModelRequest, parse: (raw: string) => T, stage: 'plan' | 'screen',
    actionMayHaveRun: boolean): Promise<T> {
    let lastError: unknown;
    let repair = '';
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      for (const provider of [options.provider, options.fallbackProvider].filter(Boolean)) {
        request.signal?.throwIfAborted();
        try {
          const raw = await provider!.generate({ ...request, messages: [...request.messages,
            ...(repair ? [{ role: 'user' as const, content: repair }] : [])] });
          try { return parse(raw); }
          catch (error) {
            lastError = error;
            repair = `Repara la respuesta para cumplir el contrato JSON. Error: ${error instanceof Error ? error.message : 'JSON inválido'}.\nRespuesta anterior:\n${raw}`;
          }
        } catch (error) {
          request.signal?.throwIfAborted();
          if (error instanceof ProviderHttpError && [401, 403, 429].includes(error.status)) {
            throw new MayaError(`Maya no pudo completar la etapa ${stage}`, stage, actionMayHaveRun, { cause: error });
          }
          lastError = error;
        }
      }
    }
    throw new MayaError(`Maya no pudo completar la etapa ${stage}`, stage, actionMayHaveRun, { cause: lastError });
  }

  return {
    async process(request: MayaRequest, signal?: AbortSignal): Promise<A2UIScreen> {
      if (typeof request.message !== 'string') throw new Error('message debe ser texto');
      signal?.throwIfAborted();
      const systemContext = typeof options.systemContext === 'function'
        ? await options.systemContext(request) : options.systemContext ?? '';
      const history = (request.history ?? []).map(item => ({ role: item.role, content: item.content }));
      const results: Record<string, unknown> = {};
      let actionMayHaveRun = false;
      function serialize(value: unknown): string {
        try { return JSON.stringify(value); }
        catch (cause) {
          throw new MayaError('El contexto o resultado no se puede serializar como JSON', 'screen', actionMayHaveRun, { cause });
        }
      }
      async function runAction() {
        if (!request.action || request.action.type === 'USER_PROMPT') return;
        if (!options.onAction) throw new MayaError('El anfitrión no registró onAction', 'action');
        try {
          signal?.throwIfAborted();
          actionMayHaveRun = true;
          results.actionResult = await options.onAction(request.action, request);
        } catch (error) {
          throw new MayaError('No se pudo completar la acción', 'action', actionMayHaveRun, { cause: error });
        }
      }
      // Con una política del anfitrión, ninguna acción se ejecuta antes de aprobar el plan.
      if (!options.onPlan) await runAction();
      let intent = '';
      let calls: MayaPlan['calls'] = [];
      if (tools.length) {
        const plan = await generate({
          purpose: 'plan', temperature: 0.1, signal,
          responseSchema: {
            type: 'object', properties: {
              intent: { type: 'string' },
              tools: { type: 'array', items: { oneOf: tools.map(tool => ({
                type: 'object', properties: { name: { const: tool.name }, args: tool.inputSchema },
                required: ['name', 'args'], additionalProperties: false
              })) } }
            }, required: ['intent', 'tools'], additionalProperties: false
          },
          messages: [
            { role: 'system', content: `Selecciona las herramientas necesarias para la solicitud.
Devuelve JSON {"intent":"descripción libre","tools":[{"name":"nombre","args":{}}]}.
Herramientas del anfitrión: ${JSON.stringify(tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })))}
${options.planningContext ?? systemContext}` },
            ...history,
            { role: 'user', content: serialize({ context: request.context,
              action: request.action, results, message: request.message }) }
          ]
        }, raw => {
          const parsed = parseModelJson(raw);
          if (!isRecord(parsed) || !Array.isArray(parsed.tools)) throw new Error('tools debe ser array');
          const calls = parsed.tools.map(call => {
            if (!isRecord(call) || typeof call.name !== 'string' || !tools.some(t => t.name === call.name) ||
                !isRecord(call.args)) throw new Error('Herramienta no registrada o args inválidos');
            return { name: call.name, args: call.args };
          });
          return { intent: typeof parsed.intent === 'string' ? parsed.intent : '', calls };
        }, 'plan', actionMayHaveRun);
        intent = plan.intent;
        const answer = await options.onPlan?.(plan, request);
        if (answer) return normalizeA2UIScreen(answer, catalog.map(component => component.type));
        calls = plan.calls;
      }
      if (options.onPlan) await runAction();
      if (tools.length) {
        const toolResults = [];
        for (const call of calls) {
          signal?.throwIfAborted();
          try {
            toolResults.push({ ...call, result: await tools.find(t => t.name === call.name)!.execute(call.args, request) });
          } catch (error) {
            toolResults.push({ ...call, error: error instanceof Error ? error.message : 'La herramienta falló' });
          }
        }
        results.tools = toolResults;
      }
      return generate({
        purpose: 'screen', temperature: options.temperature ?? 0.5, signal,
        responseSchema: {
          type: 'object', properties: {
            type: { const: 'a2ui_screen' }, screenId: { type: 'string' }, assistantMessage: { type: 'string' },
            components: { type: 'array', items: { $ref: '#/$defs/component' } },
            suggestedPrompts: { type: 'array', items: { type: 'string' } }
          }, required: ['type', 'screenId', 'assistantMessage', 'components'], additionalProperties: false,
          $defs: { component: { type: 'object', properties: {
            id: { type: 'string' }, type: { enum: catalog.map(component => component.type) },
            props: { type: 'object' }, children: { type: 'array', items: { $ref: '#/$defs/component' } }
          }, required: ['id', 'type', 'props'], additionalProperties: false } }
        },
        messages: [
          { role: 'system', content: buildScreenPrompt(catalog, systemContext) }, ...history,
          // La solicitud al final evita que la pantalla previa eclipse la consulta actual.
          { role: 'user', content: serialize({ context: request.context,
            intent, action: request.action, previousScreen: request.screen, results, message: request.message }) }
        ]
      }, raw => normalizeA2UIScreen(parseModelJson(raw), catalog.map(c => c.type)), 'screen', actionMayHaveRun);
    }
  };
}
export type Maya = ReturnType<typeof createMaya>;

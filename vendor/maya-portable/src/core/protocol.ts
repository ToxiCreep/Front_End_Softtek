import type { A2UIComponent, A2UIScreen } from './types.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function parseModelJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
}
function string(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
function requireAction(value: unknown, path: string): void {
  if (!isRecord(value) || typeof value.label !== 'string' || !value.label.trim() ||
      typeof value.actionType !== 'string' || !value.actionType.trim()) {
    throw new Error(`${path}: requiere label y actionType`);
  }
  if (value.payload !== undefined && !isRecord(value.payload)) {
    throw new Error(`${path}.payload debe ser un objeto`);
  }
}
/** Normalización técnica únicamente: no consulta datos ni añade reglas de negocio. */
export function normalizeA2UIScreen(raw: unknown, allowedTypes?: Iterable<string>): A2UIScreen {
  const source = isRecord(raw) && isRecord(raw.a2ui_screen) ? raw.a2ui_screen : raw;
  if (!isRecord(source) || !Array.isArray(source.components)) {
    throw new Error('La pantalla requiere un array components');
  }
  if (source.type !== undefined && source.type !== 'a2ui_screen') {
    throw new Error('type debe ser a2ui_screen');
  }
  const allowed = allowedTypes ? new Set(allowedTypes) : undefined;
  const ids = new Set<string>();
  let count = 0;
  const component = (value: unknown, path: string, depth = 0): A2UIComponent => {
    if (++count > 200 || depth > 12) throw new Error('La pantalla excede el límite de componentes o profundidad');
    if (!isRecord(value)) throw new Error(`${path}: componente inválido`);
    const type = string(value.type ?? value.component, '');
    if (!type || (allowed && !allowed.has(type))) throw new Error(`${path}: tipo no registrado ${type}`);
    const id = string(value.id, `component_${path}`);
    if (!id || ids.has(id)) throw new Error(`${path}: id vacío o duplicado`);
    ids.add(id);
    if (value.props !== undefined && !isRecord(value.props)) throw new Error(`${path}: props debe ser objeto`);
    const props = { ...(isRecord(value.props) ? value.props : {}) };
    for (const [key, item] of Object.entries(value)) {
      if (!['id', 'type', 'component', 'props', 'children'].includes(key) && !(key in props)) props[key] = item;
    }
    if (['ActionButton', 'TextInput', 'SelectInput', 'SliderInput'].includes(type)) requireAction(props, path);
    if (['OptionPills', 'ActionList'].includes(type)) {
      const entries = props[type === 'OptionPills' ? 'options' : 'actions'];
      if (!Array.isArray(entries)) throw new Error(`${path}: lista de acciones inválida`);
      entries.forEach((entry, i) => requireAction(entry, `${path}.${i}`));
    }
    if (value.children !== undefined && !Array.isArray(value.children)) throw new Error(`${path}: children debe ser array`);
    return { id, type, props, ...(Array.isArray(value.children)
      ? { children: value.children.map((child, i) => component(child, `${path}_${i}`, depth + 1)) } : {}) };
  };
  return {
    type: 'a2ui_screen',
    screenId: string(source.screenId ?? source.screenType ?? source.id, 'dynamic_screen'),
    assistantMessage: string(source.assistantMessage ?? source.message, ''),
    components: source.components.map((value, i) => component(value, String(i))),
    suggestedPrompts: Array.isArray(source.suggestedPrompts)
      ? source.suggestedPrompts.filter((value): value is string => typeof value === 'string') : []
  };
}

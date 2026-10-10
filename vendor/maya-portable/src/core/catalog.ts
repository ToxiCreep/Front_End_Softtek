import type { ComponentDefinition } from './types.js';

/** Primitivas desacopladas del catálogo original; sin bloques de negocio. */
export const DEFAULT_CATALOG: ComponentDefinition[] = [
  { type: 'Card', description: 'Contenedor con children', props: 'title?, subtitle?, variant?' },
  { type: 'Section', description: 'Sección con children', props: 'title?, subtitle?' },
  { type: 'Grid', description: 'Cuadrícula de children', props: 'columns?' },
  { type: 'Stack', description: 'Fila o columna de children', props: 'direction?: horizontal|vertical, gap?' },
  { type: 'Divider', description: 'Separador', props: '{}' },
  { type: 'SectionHeader', description: 'Encabezado', props: 'title, subtitle?, icon?, tag?' },
  { type: 'HeaderBadge', description: 'Encabezado con etiqueta', props: 'title, tag?' },
  { type: 'Text', description: 'Texto', props: 'content, size?: xs|sm|lg, bold?, color?' },
  { type: 'Icon', description: 'Icono', props: 'name, tone?, size?' },
  { type: 'AlertBanner', description: 'Aviso', props: 'message, variant?: info|warning|success|danger' },
  { type: 'StatTile', description: 'Dato destacado', props: 'label, value, subtext?, icon?, tone?, trend?' },
  { type: 'MetricItem', description: 'Métrica', props: 'label, value, subtext?, trend?' },
  { type: 'MetricGrid', description: 'Conjunto de métricas', props: 'items: [{label, value, subtext?}]' },
  { type: 'ProgressBar', description: 'Progreso', props: 'label, value, max?, unit?, tone?, subtext?' },
  { type: 'BarChart', description: 'Gráfica de barras', props: 'title?, unit?, orientation?, bars: [{label, value, color?}]' },
  { type: 'DonutChart', description: 'Gráfica circular', props: 'title?, centerLabel?, centerValue?, unit?, segments: [{label, value, color?}]' },
  { type: 'ActionButton', description: 'Emite una acción al anfitrión', props: 'label, actionType: cualquier nombre del anfitrión, payload?: objeto, variant?' },
  { type: 'ActionList', description: 'Lista de acciones', props: 'title?, actions: [{label, actionType, payload?}]' },
  { type: 'OptionPills', description: 'Opciones interactivas', props: 'label?, options: [{id?, label, actionType, payload?, selected?}]' },
  { type: 'TextInput', description: 'Campo de texto con envío', props: 'label, name?, placeholder?, defaultValue?, actionType, payload?, buttonLabel?' },
  { type: 'SelectInput', description: 'Selector con envío', props: 'label, name?, options: [{label, value}], defaultValue?, actionType, payload?, buttonLabel?' },
  { type: 'SliderInput', description: 'Rango numérico con envío', props: 'label, name?, min, max, step?, defaultValue?, unit?, actionType, payload?, buttonLabel?' },
  { type: 'QuickSuggestions', description: 'Preguntas para continuar', props: 'prompts: string[]' }
];

export function buildScreenPrompt(catalog: ComponentDefinition[], context: string): string {
  return `Genera una interfaz declarativa para la solicitud del usuario.
Devuelve JSON con este contrato:
{"type":"a2ui_screen","screenId":"identificador","assistantMessage":"mensaje","components":[{"id":"identificador","type":"tipo del catálogo","props":{},"children":[]}],"suggestedPrompts":[]}
children es opcional. El contenido y la composición dependen de la solicitud y del contexto.
Los controles emiten actionType y payload; USER_PROMPT con payload.text permite continuar la conversación.
Catálogo disponible:
${JSON.stringify(catalog)}
${context ? `\nContexto del programa anfitrión:\n${context}` : ''}`;
}

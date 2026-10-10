export interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}
export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export interface ModelRequest {
  messages: ModelMessage[];
  purpose: 'plan' | 'screen';
  temperature: number;
  responseSchema?: Record<string, unknown>;
  signal?: AbortSignal;
}
/** Implementable con cualquier modelo; se ejecuta en el servidor. */
export interface ModelProvider {
  generate(request: ModelRequest): Promise<string>;
}
export interface A2UIComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: A2UIComponent[];
}
export interface A2UIScreen {
  type: 'a2ui_screen';
  screenId: string;
  assistantMessage: string;
  components: A2UIComponent[];
  suggestedPrompts?: string[];
}
export interface MayaAction {
  type: string;
  payload?: Record<string, unknown>;
  componentId?: string;
}
export interface MayaRequest {
  message: string;
  context?: Record<string, unknown>;
  history?: HistoryItem[];
  action?: MayaAction;
  screen?: A2UIScreen;
}
export interface ComponentDefinition {
  type: string;
  description: string;
  props: string;
}
export interface MayaTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(args: Record<string, unknown>, request: MayaRequest): unknown | Promise<unknown>;
}
export interface MayaPlan {
  intent: string;
  calls: Array<{ name: string; args: Record<string, unknown> }>;
}
export interface MayaOptions {
  provider: ModelProvider;
  fallbackProvider?: ModelProvider;
  /** Identidad, reglas y dominio pertenecen al programa anfitrión. */
  systemContext?: string | ((request: MayaRequest) => string | Promise<string>);
  /** Reglas de selección de herramientas; evita procesar reglas de diseño en la planificación. */
  planningContext?: string;
  catalog?: ComponentDefinition[];
  tools?: MayaTool[];
  /** Puede devolver una respuesta del anfitrión antes de ejecutar herramientas o acciones. */
  onPlan?: (plan: MayaPlan, request: MayaRequest) => A2UIScreen | undefined | Promise<A2UIScreen | undefined>;
  onAction?: (action: MayaAction, request: MayaRequest) => unknown | Promise<unknown>;
  maxAttempts?: number;
  temperature?: number;
}

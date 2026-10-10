export const writeActions = ['ADD_STOCK', 'REGISTER_SALE', 'ACTIVATE_PROMOTION', 'DISMISS_PROMOTION', 'SET_IA'] as const
export const appRoutes = ['/', '/inventario', '/promociones', '/demanda', '/ajustes'] as const
export interface ActionReview {
  operationId: string
  title: string
  description: string
  action: { type: string; payload?: Record<string, unknown>; componentId?: string }
}

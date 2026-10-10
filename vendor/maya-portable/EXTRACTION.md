# Mapa de extracción

La aplicación original se conserva. Este paquete no importa sus archivos ni necesita sus dependencias o datos. La extracción adapta las partes reutilizables; no es una copia literal del orquestador bancario.

| Origen | Destino portable | Adaptación |
| --- | --- | --- |
| `backend/src/agent/ollama.ts`: `callOllamaRaw` | `src/core/providers.ts`: `createOllamaProvider` | Opciones explícitas, modelos configurables, cancelación y timeout. |
| `backend/src/agent/ollama.ts`: `classifyIntentAndTools`, `runMcpTools` | `src/core/engine.ts`: planificación y herramientas | Herramientas del anfitrión; intenciones libres; sin heurística bancaria ni usuario fijo. |
| `backend/src/agent/ollama.ts`: `generateA2UIScreen`, reparación y fallback | `src/core/engine.ts` | Reintentos y reparación del contrato; sin bloques ni gráficas obligatorios. Respaldo configurable también para JSON inválido. |
| `backend/src/agent/ollama.ts`: `normalizeA2UIScreen` | `src/core/protocol.ts` | Mantiene alias, props directas y children; retira hidratación bancaria y cifras por defecto. No fabrica una pantalla de éxito cuando falla. |
| `backend/src/agent/prompts.ts` | `src/core/catalog.ts`: `buildScreenPrompt` | Solo gramática/catálogo; contexto, reglas e identidad externos. |
| `backend/src/agent/ollama.ts`: fallback Gemini; `backend/src/agent/gemini.ts` | `src/core/providers.ts`: `createGeminiProvider` | Transporte REST de Gemini con historial y JSON. El orquestador bancario alternativo de `gemini.ts` no está conectado a `backend/src/index.ts`; sus mutaciones y pantallas fijas se retiran. |
| `backend/src/index.ts`: `/api/chat` | `src/server/index.ts` | Router independiente `/api/maya/chat`; sin status de cuenta, reset ni base de datos. |
| `frontend/src/types/a2ui.ts` | `src/core/types.ts` | Contrato compartido; elimina modelos de planes bancarios. |
| `frontend/src/components/a2ui/A2UIRenderer.tsx` y primitivas | `src/react/A2UIRenderer.tsx`, `styles.css` | Renderizado recursivo neutral, controles y gráficas genéricos; sin Tailwind o identidad del banco. Extensión por catálogo y renderizadores propios. |
| `frontend/src/components/chat/ChatContainer.tsx`, `ChatBubbleModal.tsx` | `src/react/MayaAssistant.tsx`, `src/browser/client.ts` | Conversación, historial, resultados e interacciones; sin shell de banca, tareas prefijadas ni confirmación bancaria. |
| Voz: no existía implementación; propuesta en `CODEX_HANDOFF.md` | `src/browser/voice.ts`, `src/react/useVoiceInput.ts` | Implementación nueva de dictado con Web Speech. |

## Acoplamientos retirados

- Nombre, identidad visual y trato financiero fijados al banco.
- `usr_carlos_01`, tarjeta de ejemplo, destinatario/montos por defecto y datos sintéticos.
- Clasificador por expresiones regulares e intenciones financieras cerradas.
- `get_client_financial_status`, simulación/ejecución bancaria y `get_ui_kit` con datos de negocio.
- Catálogo cerrado de acciones bancarias, inferencias de acciones a partir de etiquetas y confirmaciones del chat.
- Mínimo de cuatro componentes, encabezado + dos métricas + gráfica obligatorios y sugerencias bancarias insertadas por defecto.
- Bloques de dominio: `MetricComparison`, `PlanOptionList`, `InvestmentSimulator`, `TransactionTable`, `TransferCard`, `FinancialHealthScore` y `ConfirmationCard`. Se pueden registrar como componentes del anfitrión si el nuevo programa los requiere.
- Lectura implícita de `.env` dentro del motor. Solo el servidor de ejemplo carga variables de entorno.

## Frontera técnica

Se conservan el JSON renderizable, IDs únicos, tipos registrados, estructura recursiva y `label`/`actionType` en controles. Se aceptan pantallas simples y listas vacías; no hay mínimos de composición ni de sugerencias. No hay políticas de contenido añadidas al motor. Las limitaciones del modelo y del servicio externo no son código extraíble del repositorio.

El paquete entrega el flujo portable y los puntos de integración. Datos, contexto, herramientas, acciones, autenticación y renderizadores de dominio corresponden al programa nuevo.

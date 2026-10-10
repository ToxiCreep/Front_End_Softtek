# Maya portable

Extracción independiente del motor de interfaces de `hackmty2026-main`. Puedes copiar esta carpeta completa a otro proyecto; no importa archivos del proyecto original.

Maya es un orquestador que usa un modelo externo para convertir una petición en JSON de componentes y renderizarlo. No hay un modelo entrenado propio ni pesos que extraer. Se conserva el contrato `a2ui_screen` de este proyecto; no se afirma compatibilidad con otra implementación del estándar A2UI.

## Qué incluye

- Texto → contexto/historial → selección de herramientas del anfitrión → generación JSON → renderizador.
- Ollama local o Cloud y Gemini, configurable como principal o respaldo. También puedes implementar `ModelProvider` para otro modelo.
- Normalización recursiva, reparación de JSON y reintentos de generación.
- React con contenedores, texto, métricas, gráficas, botones, listas, selectores, campos y sliders. Catálogo y renderizadores ampliables.
- Acciones con nombres y payloads definidos por tu programa, que vuelven al motor junto con la pantalla previa.
- Voz → transcripción → mismo flujo de texto. Control de inicio, fin, cancelación y errores.
- API HTTP independiente para usar el motor desde otra tecnología.

Se retiraron la marca, colores, datos de ejemplo, usuarios, clasificación financiera, herramientas bancarias, operaciones bancarias, confirmaciones obligatorias y reglas que imponían cantidades de bloques o gráficas. `systemContext` está vacío por defecto. El formato JSON y los tipos registrados son el contrato técnico que permite dibujar la interfaz; los componentes y acciones disponibles los decide el anfitrión. Las políticas y límites del proveedor/modelo siguen perteneciendo a ese proveedor.

La copia original no implementaba voz: solo la proponía en `CODEX_HANDOFF.md`. Esta extracción añade esa parte; no se presenta como código de voz que ya existiera.

## Ejecutar la demo

Requiere Node 22.12 o superior. Desde esta carpeta:

```sh
npm ci
cp .env.example .env
# Edita .env: añade OLLAMA_API_KEY o GEMINI_API_KEY.
npm run dev
```

Abre `http://localhost:5174`. La API escucha en `http://127.0.0.1:3002/api/maya`. Los puertos son distintos a los de la app original. Si cambias `PORT`, configura también `BACKEND_URL` para el proxy de Vite.

Los nombres de modelo de `.env.example` proceden del proyecto original. Debes usar un modelo habilitado en tu cuenta. Para Ollama local, cambia `OLLAMA_HOST=http://localhost:11434` y **ambos** `OLLAMA_MODEL` y `A2UI_MODEL` por un modelo instalado. No hace falta API key local.

Ejemplos: «Crea un formulario de registro para un evento», «Diseña un tablero con estas tareas: revisar diseño, preparar demo», «Convierte estos datos en gráfica: lunes 12, martes 18, miércoles 9».

La demo no registra herramientas ni ejecuta acciones del negocio. Los botones `USER_PROMPT` continúan la conversación; otras acciones requieren `onAction` del anfitrión. No se simulan operaciones exitosas para suplir una integración pendiente.

## Usar como paquete en otro proyecto

```sh
# En esta carpeta
npm run build
npm pack
# En el proyecto destino
npm install /ruta/maya-portable-1.0.0.tgz
```

También puedes copiar `src/core`, `src/browser`, `src/react` y `src/server`; conserva sus rutas relativas. El núcleo no necesita React ni Express. El módulo HTTP usa Express; la vista usa React. No hay dependencia de Tailwind ni de la base de datos original.

### Backend

```ts
import express from 'express';
import { createMaya, createOllamaProvider } from 'maya-portable';
import { createMayaRouter } from 'maya-portable/server';

const maya = createMaya({
  provider: createOllamaProvider({
    model: process.env.A2UI_MODEL!,
    apiKey: process.env.OLLAMA_API_KEY,
  }),
  systemContext: 'Aquí pones la identidad, reglas y contexto de tu nuevo programa.',
  tools: [], // Agrega las consultas o herramientas de tu aplicación.
  onAction: async (action, request) => {
    // Tu programa interpreta action.type y action.payload y devuelve el resultado.
    return handleMyApplicationAction(action, request.context);
  },
});
const app = express();
app.use('/api/maya', createMayaRouter(maya));
app.listen(3002);
```

`handleMyApplicationAction` representa tu propia función; no viene implementada en el paquete. Para usar Gemini, importa `createGeminiProvider({ apiKey, model })` y asígnalo a `provider` o `fallbackProvider`. Las claves y proveedores se configuran en el servidor.

En la demo puedes poner el contexto en un archivo UTF-8 y establecer `MAYA_CONTEXT_FILE=/ruta/contexto.txt`. En una integración, `systemContext` también acepta una función que recibe la petición y devuelve contexto, de forma síncrona o asíncrona.

### Herramientas y MCP

```ts
const tools = [{
  name: 'list_tasks',
  description: 'Consulta las tareas del proyecto actual',
  inputSchema: { type: 'object', properties: {} },
  execute: async (_args, request) => myDatabase.listTasks(request.context?.projectId),
}];
// createMaya({ provider, tools, ... })
```

`myDatabase` es la integración del anfitrión. Si ya tienes un registry MCP, mapea sus definiciones a `MayaTool` y en `execute` invoca `callMcpTool(name, args)` o tu cliente MCP. No se incluye el servidor MCP bancario porque sus herramientas pertenecen al proyecto original. El esquema describe los argumentos al modelo; su validación de dominio pertenece a `execute` del anfitrión. La selección de herramientas no exige categorías de intención prefijadas.

Las herramientas y `onAction` se ejecutan antes de reparar/reintentar el JSON; los reintentos no vuelven a ejecutarlos. La deduplicación entre peticiones HTTP diferentes pertenece a la aplicación que ejecuta la acción. Un error posterior a `onAction` incluye `actionMayHaveRun: true`.

### Frontend React

```tsx
import { MayaAssistant } from 'maya-portable/react';
import 'maya-portable/styles.css';

export function MyPage() {
  return <MayaAssistant endpoint="/api/maya/chat" context={{ projectId: 'mi-proyecto' }} />;
}
```

Para controlar el diseño de chat por separado, usa `createMayaClient` de `maya-portable/browser` y `A2UIRenderer` de `maya-portable/react`. Las variables CSS `--maya-primary`, `--maya-accent-bg`, etc. permiten cambiar la apariencia.

Para añadir un componente propio, agrega su definición a `catalog` en el servidor y pásalo en `components={{ MyComponent: MyRenderer }}` a `MayaAssistant` o `A2UIRenderer`. `ComponentRendererProps` recibe el componente JSON, `children`, `loading` y `onAction`. No hay generación ni ejecución de código arbitrario; el modelo compone los componentes registrados, como en la app original.

### Otra tecnología: contrato HTTP

```http
POST /api/maya/chat
Content-Type: application/json

{
  "message": "Crea una lista de tareas",
  "context": { "projectId": "mi-proyecto" },
  "history": [
    { "role": "user", "content": "La consulta anterior" },
    { "role": "assistant", "content": "La respuesta anterior" }
  ]
}
```

La respuesta es la pantalla directamente: `{ "type": "a2ui_screen", "screenId": "...", "assistantMessage": "...", "components": [...], "suggestedPrompts": [...] }`.

Para una interacción añade `action: { type: 'TU_ACCION', payload: {...}, componentId: '...' }` y `screen` con la pantalla anterior. Cualquier cliente HTTP puede usar la API; un frontend distinto a React debe dibujar el JSON con sus componentes. Los errores tienen status 400 (petición inválida) o 502 (motor/proveedor), con `error`, `stage` y `actionMayHaveRun` cuando aplica.

### Voz sin React

```ts
import { createVoiceInput, createMayaClient } from 'maya-portable/browser';
const client = createMayaClient();
const voice = createVoiceInput({
  lang: 'es-MX',
  onFinal: async message => {
    const screen = await client.process({ message });
    // Tu interfaz dibuja screen.
  },
  onError: console.error,
});
// Desde una interacción del usuario:
voice.start();
// voice.stop() termina; voice.cancel() descarta; voice.dispose() limpia.
```

La voz usa `SpeechRecognition` o `webkitSpeechRecognition` del navegador. Requiere soporte y permiso de micrófono; utiliza localhost o HTTPS. Puede usar el servicio de reconocimiento del navegador y necesitar red. Si no está disponible, el texto sigue funcionando. Es dictado de frases para generar UI, no una conversación de audio continua ni voz de salida. Para otro servicio de transcripción, manda el texto resultante al mismo `process`.

## Verificación

```sh
npm run build
npm run check
npm test
npm run build:demo
```

Las pruebas usan respuestas de modelo controladas y una API Ollama simulada en un servidor HTTP local. Cubren contexto e historial, herramientas, reparación, respaldo, acciones, cliente HTTP, renderizado React y transcripción simulada. No equivalen a una prueba con un modelo externo ni con el micrófono real. Esta extracción no contiene credenciales; esas dos verificaciones requieren configurar tu proveedor y usar un navegador compatible.

Referencias de los transportes: [Ollama chat](https://docs.ollama.com/api/chat), [Gemini generateContent](https://ai.google.dev/api/generate-content), [Web Speech](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

Consulta `EXTRACTION.md` para ver qué código se adaptó y qué se retiró.

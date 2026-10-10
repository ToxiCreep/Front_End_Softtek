# Softy: configuración, integración y verificación

Softy es el nombre visible de Maya en Mi sucursal. El motor genera JSON `a2ui_screen`; React dibuja únicamente componentes registrados. No ejecuta código React, HTML ni herramientas propuestas arbitrariamente por el modelo.

## Arrancar con Ollama Cloud y Gemma

La configuración actual usa la nube para evitar la inferencia en la Mac de 8 GB. [Ollama Free](https://ollama.com/pricing) cuesta $0 e incluye créditos iniciales para modelos disponibles en ese plan. La cuota y el acceso de la cuenta deben verificarse; no es uso ilimitado. No comprar créditos ni habilitar recargas si el gasto debe ser cero.

1. Crea una cuenta Free y una [API key](https://ollama.com/settings/keys).
2. Ejecuta `npm ci`. Crea `.env.local` desde `.env.example` si aún no existe.
3. Guarda la clave solo en `OLLAMA_API_KEY` y arranca `npm run dev`.

```dotenv
VITE_API_BASE_URL=/api/v1
SOFTTEK_API_URL=https://tienda-inteligente-api.onrender.com/api/v1
SOFTY_PORT=3001
SOFTY_BIND=127.0.0.1
OLLAMA_HOST=https://ollama.com
OLLAMA_API_KEY=
OLLAMA_MODEL=gemma4:31b
A2UI_MODEL=gemma4:31b
```

`OLLAMA_MODEL` planifica lecturas y `A2UI_MODEL` genera la interfaz. El modelo `gemma4:31b` se confirmó en la lista pública `https://ollama.com/api/tags`. La [API de nube](https://docs.ollama.com/cloud) usa Bearer desde Node; ni la clave ni las credenciales de Spring se envían al navegador.

Cloud no admite actualmente [structured outputs](https://docs.ollama.com/capabilities/structured-outputs): el proveedor omite `format` y las opciones locales; solicita JSON mediante el contrato del prompt y el motor lo valida antes de renderizar. `think:false` evita generar razonamiento adicional. Clave inválida (401), acceso rechazado (403) y cuota/concurrencia (429) tienen mensajes específicos y no se reintentan automáticamente. No hay fallback a un servicio de pago. La cuenta del proveedor determina la facturación.

Reinicia `npm run dev` después de cambiar `.env.local`. Para volver a local: `OLLAMA_HOST=http://127.0.0.1:11434`, ambos modelos `gemma3:4b` descargados y Ollama abierto; no se necesita clave. Ese camino conserva esquemas JSON y contexto de 8,192 tokens. La Mac inspeccionada presentó fuerte uso de swap y consultas de decenas de segundos; la nube es el modo elegido para la demo.

## Conectar el repositorio del equipo

No hay que fusionar los repositorios. La app consume Spring Boot en Render por defecto. Para cambiarlo, ajusta estos valores y reinicia:

```dotenv
VITE_API_BASE_URL=/api/v1
SOFTTEK_API_URL=https://tienda-inteligente-api.onrender.com/api/v1
```

El navegador consume rutas relativas. Vite dirige `/api` a Node durante desarrollo; `npm start` sirve la compilación y `/api`. Node usa una URL fija de Spring Boot para las pantallas, herramientas y operaciones. Reenvía Authorization/Cookie cuando existen; no envía esas credenciales al modelo. `src/adapters.ts` traduce los DTO de Spring al contrato de las páginas.

MSW y `src/demo.ts` se conservan como fixtures de las pruebas. La app ya no arranca el servidor simulado, y `VITE_USE_MOCKS` no cambia el modo de datos en ejecución. Las pruebas históricas de Ollama con datos MSW se distinguen abajo de las pruebas nuevas con Spring real.

## Vercel

`api/softy.ts` exporta la app Express de `server/app.ts`, sin abrir un puerto. `vercel.json` dirige `/api/softy/*` a esa función y `/api/v1/*` a Render. El fallback `index.html` excluye `/api/*`. Esto corrige el 405 vacío observado en producción: POST `/api/softy/chat` terminaba en un archivo estático y el cliente intentaba leerlo como JSON.

Configura OLLAMA_API_KEY en **Settings → Environment Variables** para Production y Preview y vuelve a desplegar. La clave nunca usa prefijo VITE_. Los valores predeterminados son OLLAMA_HOST=https://ollama.com, OLLAMA_MODEL=gemma4:31b, A2UI_MODEL=gemma4:31b y SOFTTEK_API_URL=https://tienda-inteligente-api.onrender.com/api/v1. Si cambia Spring, actualiza también el destino de `/api/v1/*` en `vercel.json`. Las [funciones Node](https://vercel.com/docs/functions/runtimes/node-js) tienen aquí maxDuration:300; para proyectos antiguos, [Fluid Compute y los límites](https://vercel.com/docs/functions/configuring-functions/duration) deben admitir ese valor.

Comprueba GET `/api/softy/health` (JSON, providerConfigured:true) y una consulta en `/softy`. El cliente maneja cuerpos vacíos, HTML y JSON truncado con un mensaje legible, sin mostrar errores internos del navegador. La preparación de acciones usa el mismo manejo de respuestas.

## Flujo y acciones

Texto o transcripción final → historial, página anterior y pantalla previa → consultas de lectura → JSON validado → renderizado → interacción → revisión de la API → confirmación → operación → recibo A2UI construido por el servidor con la respuesta de la API.

La conversación conserva hasta 24 mensajes y la última pantalla en `sessionStorage`, dentro de la misma pestaña. Navegar conserva el estado y recargar lo restaura; Nueva conversación borra el chat actual, pero conserva las cinco interfaces más recientes en la misma pestaña. El botón Historial permite restaurar una interfaz y su conversación sin consultar al modelo; se identifica como guardada y sus datos corresponden al momento de generación. Las escrituras siguen pasando por la revisión de la API y la confirmación habituales. La página de negocio más reciente se mantiene como contexto al entrar en Softy. El servidor pasa al modelo los seis mensajes más recientes (tres turnos) y la pantalla anterior; la configuración se consulta mediante get_branch cuando la solicitud lo requiere. Las reglas de planificación están separadas de las de diseño. El contexto del navegador es informativo: no otorga permisos.

| Herramienta | Datos consultados |
| --- | --- |
| `get_branch` | Configuración y límites |
| `list_products` | Productos, IDs, precios y existencias; filtros `q`/`categoria` |
| `get_inventory` | Productos con stock bajo o agotados y sus pedidos sugeridos, compactados desde estado y reabasto; excedentes e inventario completo mediante `list_products` |
| `get_sales` | Indicadores y serie diaria; hasta 31 días |
| `get_promotions` | Promociones, explicación y estado |
| `get_demand` | Producto y comparación de estimaciones |
| `get_product_sales` | Producto y unidades observadas por día; siete días completos por defecto |

Los datos desconocidos permanecen `null`: no se presentan como cero. Las estimaciones nunca se consideran ventas realizadas. Fechas, filtros, identificadores y cantidades se validan en el servidor.

| Acción | Operación del anfitrión |
| --- | --- |
| `OPEN_PAGE` | Navegar a Inicio, Productos, Promociones, Demanda o Ajustes |
| `USER_PROMPT` | Continuar una consulta con el texto o valor actualizado |
| `FILTER_PRODUCTS` | Consultar productos con el valor editado |
| `SELECT_PRODUCT` | Consultar demanda con el ID seleccionado |
| `ADD_STOCK` | POST movimiento ENTRADA con producto, cantidad y motivo |
| `REGISTER_SALE` | POST venta de un producto con ticket estable |
| `ACTIVATE_PROMOTION` / `DISMISS_PROMOTION` | PATCH estado ACTIVA / RECHAZADA |
| `SET_IA` | PATCH configuración de asistencia con `{ proveedorIA }`: 0 ninguna, 1 Gemini, 2 Claude, 3 GPT |

Los formularios `StockForm` y `SaleForm` cargan productos desde el cliente existente, piden valores al usuario y validan cantidades. El servidor retira los ActionButton ADD_STOCK / REGISTER_SALE que genera el modelo: las cantidades se introducen en los formularios del anfitrión. Las cinco acciones de escritura siempre solicitan revisión y confirmación. La revisión utiliza el nombre y estado consultados en la API, no solo texto del modelo. Spring Boot sigue siendo responsable de transacciones, stock final, precio, descuentos, estados y permisos.

Cada revisión recibe un operationId opaco. Con OLLAMA_API_KEY configurada, contiene una revisión firmada con HMAC-SHA256, válida diez minutos y vinculada a Authorization/Cookie. La clave usa un dominio de firma separado; nunca viaja al navegador. Otra instancia puede recuperar la operación canónica, pero no acepta modificaciones del cuerpo, cambios de sesión, firmas de otra clave ni revisiones vencidas. La confirmación conserva el UUID original para Idempotency-Key y el ticket estable de venta. Sin clave, el modo local conserva revisiones en memoria.

Repetir una confirmación dentro de la misma instancia reutiliza su promesa de ejecución. Después de guardar, el servidor devuelve un recibo sin llamar al modelo; si la API devuelve stockResultante, muestra ese valor directamente. Un fallo incierto puede devolver actionMayHaveRun:true; la UI advierte y actualiza los datos, sin reenviar automáticamente la escritura.

**Límite actual:** recibos en memoria por instancia, hasta 1,000, podados tras 24 horas al preparar operaciones. Las firmas conservan la revisión entre instancias, pero no impiden repetir una escritura en instancias distintas. El backend inspeccionado no implementa Idempotency-Key para movimientos de existencias; debe persistir la idempotencia. Los tickets de venta se rechazan si ya existen. Spring también debe aplicar permisos: la app aún no tiene sesión autenticada.

Softy limita las consultas al negocio con intents cerrados, herramientas permitidas por tarea y filtrado de acciones y navegación antes de renderizar. Rechaza literatura, cambios de rol y consultas ajenas; una solicitud mezclada se rechaza completa. La selección semántica sigue dependiendo del modelo: no se garantiza un bloqueo del 100 % de prompt injection.

## Voz

Se usa `SpeechRecognition` o `webkitSpeechRecognition` del navegador con `es-MX`. Dictar inicia, Terminar cierra el dictado y Cancelar descarta el envío. Los resultados provisionales solo se muestran; la transcripción final se envía una vez al mismo flujo que el texto. Al salir de la vista se limpia el reconocimiento.

Sin soporte, permiso, micrófono o servicio disponible se muestra un mensaje y se conserva la escritura. Un error libera el reconocedor aunque el navegador no emita onend; se puede volver a dictar y un resultado tardío no se envía. El error de red orienta a abrir la misma página en Chrome o Safari con internet; el navegador integrado puede exponer la API sin tener un servicio operativo. Usa localhost o HTTPS y concede el permiso desde tu navegador. La voz es dictado, no conversación de audio continua ni voz de salida. **Web Speech puede usar un servicio remoto del navegador**: configurar Ollama local no convierte el dictado en transcripción offline.

## Implementación y configuración

- `src/Softy.tsx`: cliente del paquete, historial, voz, renderizador y formularios del negocio; usa QueryClient y el Modal existentes.
- `src/softy.css`: estilos oscuros y marca, controles táctiles, móvil y escritorio.
- `src/softy-contract.ts`: acciones, páginas y respuesta de revisión compartidas.
- `server/host.ts`: cliente REST, herramientas de lectura y operaciones canónicas.
- `server/softy.ts`: validación, contexto, revisiones, deduplicación y motor Maya.
- `server/app.ts`, `api/softy.ts`: Ollama, proxy, archivos de producción y función Vercel; `server/index.ts` abre el puerto local.
- `vendor/maya-portable/`: fuentes originales del ZIP. Cambios: `useRef` compatible con React 19, límite de 200 componentes / profundidad 12, esquemas de salida para plan y pantalla y contexto Ollama de 8,192 tokens. React se comparte con la app, sin una segunda instalación en vendor.

El catálogo de Softy contiene Card, Section, Grid, Stack, Text, AlertBanner, StatTile, BarChart, ActionButton, QuickSuggestions, StockForm y SaleForm. El paquete conserva su catálogo general; Softy limita las opciones del modelo para generar interfaces simples. Los formularios del anfitrión seleccionan productos por nombre y piden cantidades, sin mostrar IDs internos. El esquema de salida asegura la estructura; no demuestra por sí solo que la interpretación o los datos del modelo sean correctos.

SOFTY_PORT cambia el puerto Node y el destino del proxy Vite. SOFTY_BIND limita la escucha; el valor predeterminado es loopback. SOFTTEK_API_URL permite cambiar el backend de Render predeterminado. Ningún modelo ni secreto se expone con prefijo VITE_. `.env.local` y `.vercel/` están ignorados por Git.

Para servir la compilación: `npm run build` y `npm start`; abre `http://127.0.0.1:3001/softy`. En Vercel usa el preset Vite, `npm run build` y salida dist; la API se compila aparte desde api/softy.ts. El health solo demuestra que el servidor está activo y la clave presente, **no su validez ni que Ollama haya generado una interfaz**.

## Pruebas realizadas y pendientes

Comandos reproducibles:

```sh
npm test
npm run build
npm run check:portable
npm run build:portable
npm run build:demo
```

La suite reúne 90 pruebas del proyecto, integración y paquete. El ZIP se comprobó inicialmente con sus 21 pruebas, compilación, tipos y demo antes de adaptarlo. La regresión de inventario verifica que la herramienta conserve las cifras de la API y solo incluya productos con stock bajo o agotados. La prueba HTTP local del paquete exige esquemas en ambas etapas; la prueba de transporte Cloud comprueba su omisión, la cabecera de autorización y think:false. Se verifica que errores 401/403/429 no provocan reintentos, y que la recuperación del dictado no requiere onend. El servidor verifica también recibos independientes del modelo, deduplicación concurrente y eliminación de botones con cantidades preseleccionadas. Otra regresión conserva la última página de negocio al navegar y recargar sin enviar otra consulta.

| Comprobación | Evidencia / alcance |
| --- | --- |
| Texto, contexto, historial y pantalla anterior | Pruebas automáticas con proveedor controlado |
| Dictado final una vez, cancelación, permiso denegado y navegador sin soporte | Reconocimiento simulado; no audio físico |
| Datos, alta de stock, venta, promociones y asistencia | HTTP real local contra los handlers MSW existentes; datos simulados |
| Confirmación, valores editados y controles | Pruebas React y API; sin operaciones antes de confirmar |
| Duplicados, concurrencia, JSON inválido y fallo tras acción | Pruebas del servidor y motor con proveedor controlado; recibos de Softy sin generación del modelo |
| Diseño y operación de existencias | Navegador con proveedor controlado y datos de ejemplo; escritorio y móvil |
| Ollama Cloud / Gemma real (prueba inicial) | Datos MSW: HTTP y navegador con gemma4:31b; tiempos de 1.60–3.27 s |
| Gemma Cloud + Spring real (10 octubre 2026) | Reposición en 4.44 s; cuatro cifras cotejadas con Render. La misma consulta en Vercel CLI local: 5.89 s. Rechazo de resumen de novela: 8.47 s. |
| Función y rutas de Vercel | Build de producción con ajustes de sofftek y arranque del paquete compilado directamente en Node, sin Vite/tsx. HTTP real en Vercel CLI local para health, chat y actions/prepare. Revisión real preparada, sin guardar. |
| Revisiones entre instancias | Pruebas simuladas: recuperación firmada, concurrencia, firma inválida, otra sesión, payload alterado y vencimiento. |
| Ollama / Gemma local real | Probado: reposición, formulario de existencias y lectura del stock actualizado; detalles abajo |
| Micrófono físico y PWA en dispositivos | No realizados; el usuario pidió probar solo texto en esta ronda |
| Spring Boot del equipo | Lecturas reales y adaptación de DTO verificadas en Render; sin escrituras reales en esta ronda. |

La revisión visual inicial cubrió escritorio de 1440 px con proveedor controlado y el breakpoint móvil de 496 px en el navegador integrado, sin desbordamiento horizontal y con controles de 44 px o más. El flujo visual de stock pasó de 8 a 13 unidades y Productos reflejó el mismo dato. `npm start` respondió 200 para `/softy`, health y la API de productos. La prueba posterior con Gemma real se detalla a continuación; la prueba en un celular físico sigue pendiente.

El intento anterior con Gemini falló con HTTP 401 durante la generación; listar modelos no fue evidencia de generación exitosa. Al cambiar a Ollama se retiró la configuración Gemini local.

### Prueba real con Ollama Cloud — 10 de octubre de 2026

Proveedor real `https://ollama.com`, modelo `gemma4:31b`, clave privada del servidor, `think:false`. Datos de negocio MSW de ejemplo; no Spring Boot. Dos consultas HTTP completas en instancia aislada, sin operaciones de escritura:

| Consulta | Plan | Interfaz | Tiempo total | Resultado |
| --- | --- | --- | --- | --- |
| ¿Qué productos necesito reponer? | 0.84 s | 2.35 s | 3.27 s | Existencias 8, 14 y 0; pedidos sugeridos 76, 77 y 98, correctos frente a la API. |
| Quiero agregar existencias de leche entera | 0.49 s | 1.10 s | 1.60 s | Un StockForm con productoId 1 y sin cantidad preseleccionada, conservando historial y pantalla anterior. |

Después se reinició `npm run dev` con configuración Cloud. La consulta de reposición pasó también desde la interfaz del navegador integrado y mostró las mismas cifras. Captura: `output/softy-cloud-reposicion.jpg`, 1280 × 1012. Registros: `output/softy-latency.jsonl` y `output/softy-latency-results.jsonl`; no contienen la clave ni cabeceras de autorización. La clave permanece en `.env.local`, ignorado por Git y con permisos 600.

58 pruebas automáticas aprobadas; build web, tipos y build portable aprobados. La regresión de voz usa un reconocedor simulado: prueba que un error de red libera el micrófono lógico, permite reiniciar y no envía transcripciones tardías. No se dictó con micrófono físico ni se comprobó voz en Chrome/Safari. Cambiar el modelo a Cloud no sustituye el reconocimiento de voz del navegador. No se verificó el saldo ni la configuración de facturación de la cuenta; se confirmó acceso al modelo y respuestas HTTP 200. El plan Free tiene cuota; no se realizaron compras, recargas ni cambios de plan.

Se descargó parcialmente una versión local de 1B para comparar, pero se canceló al decidir usar la nube y no se cambió a ese modelo. `gemma3:4b` quedó descargado y se liberó de memoria. Las mediciones locales previas fueron de decenas de segundos y la Mac presentó 8.4 GB de swap en uso; no son un benchmark controlado entre modelos.

### Prueba anterior con proveedor local real — 10 de octubre de 2026

Se verificó `gemma3:4b` instalado en Ollama local, Q4_K_M, digest `68ceab7e468a`. Navegador integrado en macOS, viewport medido de 1280 × 720 px. Se usó una instancia aislada de la app con `SOFTY_PORT=3003`, `VITE_USE_MOCKS=true` y la compilación de producción, para conservar los datos de la instancia abierta del usuario. Un registro HTTP temporal reenvió las solicitudes a Ollama sin modificar sus respuestas. No se sustituyó el proveedor por un fixture.

| Caso | Resultado observado |
| --- | --- |
| “¿Qué productos necesito reponer?” | Leche 8, pan 14 y huevos 0; sugerencias 76, 77 y 98, coincidentes con la API de ejemplo. Plan + generación: aproximadamente 52 s. |
| Solicitar formulario de existencias con historial | Formulario real del anfitrión con leche seleccionada, cantidad vacía y datos consultados en la API. Se retiró el botón con una cantidad preseleccionada por el modelo. |
| Revisar 5 unidades | La API seguía mostrando 8; la revisión identificó producto, cantidad y motivo. |
| Confirmar y guardar | La API pasó a 13. El recibo construido por el servidor mostró 13 y Productos reflejó el mismo dato. No se llamó a Gemma para producir el recibo. |
| Navegar a Productos, volver y recargar | Historial de 5 intercambios y recibo restaurados; la última página de negocio quedó conservada. |
| “¿Cuántas unidades de leche entera tengo ahora?” | Gemma consultó la API y mostró 13. Se verificaron contexto `/inventario`, 10 mensajes históricos y la pantalla anterior en la solicitud. Plan + generación: aproximadamente 46 s. |

Antes de estos resultados hubo fallos reales: selección de herramientas incorrecta, JSON recortado con 4,096 tokens, controles incompletos, interpretación incorrecta de stock y repetición de la pantalla anterior. Se aplicaron esquemas JSON, contexto de 8,192 tokens, catálogo más pequeño, datos de reposición compactos y la solicitud actual al final del contexto. La confirmación de operaciones se movió a recibos construidos por el servidor para no depender de la generación posterior al guardado.

Las pruebas demuestran estos casos concretos, no precisión garantizada en todas las preguntas ni protección total frente a prompt injection. Los datos y escrituras siguen siendo de ejemplo. Ventas, promociones y cambios de proveedor se verificaron automáticamente con API simulada; no se probaron todos esos casos con Gemma real. No se usó micrófono físico ni Spring Boot del equipo.

Evidencia local, ignorada por Git: `output/gemma-pruebas.jsonl`, `output/softy-gemma-inventario.jpg` y `output/softy-gemma-operacion.jpg`. Los servidores auxiliares y el registro temporal se cierran al terminar; para repetir, usa la configuración normal de Ollama en el puerto 11434.

Para repetir manualmente:

1. Comprueba `ollama list` y abre Softy con el servidor de desarrollo.
2. Escribe “¿Qué productos necesito reponer?” y verifica una interfaz con cifras de la API; no basta con `/health`.
3. Pide agregar existencias, selecciona un producto y cantidad, revisa y confirma. Comprueba la nueva cantidad en Productos.
4. Dicta una frase y verifica un solo envío. Prueba Cancelar antes de terminar y permiso denegado; el texto debe seguir disponible.
5. Repite el caso con `VITE_USE_MOCKS=false` cuando Spring Boot esté listo. Registra navegador, modelo, latencia y resultados por separado del ensayo simulado.

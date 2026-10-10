# Mi sucursal — hackathon Softtek

PWA en español para administrar ventas, existencias, promociones y demanda. Una misma web para computadora, Android e iPhone, con identidad Softtek y Helvetica Neue. **Softy** genera interfaces desde texto o dictado usando Maya Portable y Ollama Cloud con Gemma. Spring Boot vive en el repositorio del equipo y se conecta mediante REST.

## Ejecutar

Requiere Node.js **22.12 o superior** y npm. Softy usa [Ollama Cloud](https://docs.ollama.com/cloud) con `gemma4:31b`; no requiere instalar Ollama ni descargar el modelo en la computadora.

Crea una cuenta **Free** y una [API key](https://ollama.com/settings/keys). El [plan de $0](https://ollama.com/pricing) incluye créditos iniciales y límites; el acceso al modelo depende de la cuenta y de la cuota disponible. Para mantener el gasto en cero, no compres créditos ni actives recargas. Si la cuota se agota, Softy informa el límite; no cambia de proveedor ni contrata un plan.

Desde este repositorio:

```sh
npm ci
cp .env.example .env.local
```

Si ya existe `.env.local`, edítalo sin reemplazar tu configuración. Coloca la clave en `OLLAMA_API_KEY` (sin prefijo `VITE_`) y ejecuta `npm run dev`. El ejemplo usa `OLLAMA_HOST=https://ollama.com` y `gemma4:31b` en **OLLAMA_MODEL y A2UI_MODEL**. Reinicia el servidor después de cambiar las variables.

Abre `http://localhost:5173/softy`. `npm run dev` inicia Vite y el servidor Node de la API en el puerto 3001. Las pantallas y Softy consumen la API real del equipo en Render. MSW queda únicamente para pruebas; `VITE_USE_MOCKS` ya no activa datos de ejemplo. Si Ollama no está disponible, Softy muestra un error; las pantallas tradicionales siguen funcionando.

## Conectar Spring Boot

Configura `.env.local` con la URL del backend del equipo, incluyendo `/api/v1`:

```dotenv
VITE_API_BASE_URL=/api/v1
SOFTTEK_API_URL=https://tienda-inteligente-api.onrender.com/api/v1
OLLAMA_HOST=https://ollama.com
OLLAMA_API_KEY=
OLLAMA_MODEL=gemma4:31b
A2UI_MODEL=gemma4:31b
```

Reinicia `npm run dev`. El navegador llama a la API del mismo origen; Node conecta tanto las pantallas como las herramientas de Softy con Spring Boot. No hace falta copiar su repositorio ni abrir CORS de Spring al navegador con esta configuración. `src/adapters.ts` traduce los DTO reales de Spring al [contrato de las pantallas](contracts/openapi.json). Para usar Spring local, cambia SOFTTEK_API_URL a `http://localhost:8080/api/v1`.

Las variables `VITE_*` son públicas. No colocar secretos allí. El host y los modelos de Ollama se configuran solo en el servidor.

## Verificar y servir la compilación

```sh
npm test
npm run build
npm run check:portable
npm run build:portable
npm run build:demo
npm start
```

`npm start` sirve `dist/`, la API y el fallback para rutas como `/softy` desde `http://127.0.0.1:3001`. Conserva `server/`, `src/`, `vendor/`, `package.json`, dependencias y configuración en el despliegue: este flujo requiere Node, no solo hosting de archivos estáticos. `npm run preview` únicamente previsualiza la compilación y no sustituye el servidor de la API.

El manifest y los iconos están preparados; el worker guarda solo la interfaz estática y se activa en producción. Las ventas no se encolan offline. La instalación PWA en dispositivos físicos sigue pendiente.

## Vercel: proyecto sofftek

Vercel sirve `dist/` y ejecuta `api/softy.ts` como función Node. `vercel.json` envía `/api/softy/*` a esa función y `/api/v1/*` a Render; las rutas de la app reciben `index.html`. Nunca debe usarse el fallback de la página para una ruta `/api`.

En **Settings → Environment Variables**, configura para Production y Preview:

```dotenv
OLLAMA_API_KEY=<clave privada de Ollama Cloud>
OLLAMA_HOST=https://ollama.com
OLLAMA_MODEL=gemma4:31b
A2UI_MODEL=gemma4:31b
SOFTTEK_API_URL=https://tienda-inteligente-api.onrender.com/api/v1
```

La clave se guarda en Vercel, sin prefijo `VITE_`; no se sube a GitHub. Host, modelos y URL de Spring tienen esos valores predeterminados. Conserva VITE_API_BASE_URL como `/api/v1` si lo configuras. Si cambia Render, actualiza también su destino en `vercel.json` para que las páginas y Softy consulten el mismo backend.

Sube los cambios a GitHub y vuelve a desplegar después de guardar las variables. Comprueba `https://sofftek.vercel.app/api/softy/health`: debe devolver JSON con `providerConfigured:true`; luego realiza una consulta en `/softy`. La presencia de la clave no verifica su validez ni la cuota. La función tiene un límite de 300 segundos; usa Fluid Compute si el proyecto conserva límites antiguos.

`npm run api:types` regenera `src/api-schema.d.ts` después de cambiar el contrato.

## Estructura

- `src/App.tsx`, `src/pages/`: navegación y pantallas del negocio.
- `src/Softy.tsx`, `src/softy.css`: conversación, dictado, resultados y formularios de Softy.
- `server/app.ts`, `api/softy.ts`: API compartida entre ejecución local y Vercel; `server/index.ts` inicia el servidor local.
- `server/host.ts`, `server/softy.ts`: herramientas, operaciones confirmadas y conexión con Spring Boot.
- `src/api.ts`, `src/api-schema.d.ts`: cliente REST y tipos.
- `src/mocks.ts`, `src/demo.ts`: fixtures de las pruebas, fuera de la ejecución de la app.
- `vendor/maya-portable/`: código fuente del paquete suministrado, integrado con React 19 del proyecto.
- `src/styles.css`, `public/`: marca, fuentes, logo y PWA.

Stack: React, TypeScript, Vite, React Router, TanStack Query, Express, CSS con Tailwind, Lucide, MSW y Maya Portable. Las gráficas tradicionales usan SVG y tablas accesibles.

Consulta [configuración y pruebas de Softy](docs/SOFTY.md), [endpoints](docs/API.md), [plan del proyecto](docs/PLAN.md) y [diseño](docs/DISENO.md).

Las pruebas automáticas cubren proveedor y transcripción simulados; las pruebas con Gemma y Spring reales están registradas en docs/SOFTY.md. El micrófono físico sigue pendiente. Para dictar, abre localhost o HTTPS en Chrome o Safari: el servicio del navegador es independiente de Ollama. Las revisiones firmadas sobreviven cambios de instancia en Vercel, pero los recibos solo deduplican escrituras dentro de una instancia. Spring debe implementar idempotencia persistente y permisos; la app aún no incluye autenticación. Las fuentes fueron proporcionadas por el usuario; su autorización de uso web debe verificarse antes de publicar.

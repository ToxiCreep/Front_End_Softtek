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

Abre `http://localhost:5173/softy`. `npm run dev` inicia Vite y el servidor Node de la API en el puerto 3001. La app ya no trae datos simulados: necesita el backend de Spring Boot corriendo en `SOFTTEK_API_URL` (ver abajo). Si Ollama no está disponible, Softy muestra un error; las pantallas tradicionales siguen funcionando.

## Conectar Spring Boot

Configura `.env.local` con la URL del backend del equipo, incluyendo `/api/v1`:

```dotenv
VITE_API_BASE_URL=/api/v1
SOFTTEK_API_URL=http://localhost:8080/api/v1
OLLAMA_HOST=https://ollama.com
OLLAMA_API_KEY=
OLLAMA_MODEL=gemma4:31b
A2UI_MODEL=gemma4:31b
```

Reinicia `npm run dev`. El navegador llama a la API del mismo origen; Node conecta tanto las pantallas como las herramientas de Softy con Spring Boot. No hace falta copiar su repositorio ni abrir CORS de Spring al navegador con esta configuración. Su API debe responder según [OpenAPI](contracts/openapi.json); los DTO y reglas añadidos siguen pendientes de acuerdo con el equipo.

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

Para producción, configura `SOFTTEK_API_URL` al ejecutar. Usa HTTPS y un proxy inverso al servidor Node. El manifest y los iconos están preparados; el worker guarda solo la interfaz estática y se activa en producción. Las ventas no se encolan offline. La instalación PWA en dispositivos físicos sigue pendiente.

`npm run api:types` regenera `src/api-schema.d.ts` después de cambiar el contrato.

## Estructura

- `src/App.tsx`, `src/pages/`: navegación y pantallas del negocio.
- `src/Softy.tsx`, `src/softy.css`: conversación, dictado, resultados y formularios de Softy.
- `server/`: API de Softy, herramientas, operaciones confirmadas y conexión con Spring Boot.
- `src/api.ts`, `src/api-schema.d.ts`: cliente REST y tipos.
- `server/guard.ts`: candados de Softy antes y después del modelo (solo temas de la tienda).
- `test/fixtures/`: API simulada usada **solo por las pruebas** (`npm test`); no se carga en la app.
- `vendor/maya-portable/`: código fuente del paquete suministrado, integrado con React 19 del proyecto.
- `src/styles.css`, `public/`: marca, fuentes, logo y PWA.

Stack: React, TypeScript, Vite, React Router, TanStack Query, Express, CSS con Tailwind, Lucide, MSW y Maya Portable. Las gráficas tradicionales usan SVG y tablas accesibles.

Consulta [configuración y pruebas de Softy](docs/SOFTY.md), [endpoints](docs/API.md), [plan del proyecto](docs/PLAN.md) y [diseño](docs/DISENO.md).

Las pruebas automáticas cubren proveedor y transcripción simulados; las pruebas con Gemma real están registradas en docs/SOFTY.md. El micrófono físico sigue pendiente. Para dictar, abre localhost o HTTPS en Chrome o Safari: el servicio del navegador es independiente de Ollama. Las predicciones del negocio siguen siendo ejemplos hasta conectar Spring Boot. Esta app aún no incluye autenticación; los recibos de Softy deduplican escrituras dentro de una sola instancia Node. Antes de uso público, el backend debe aplicar permisos e idempotencia persistente. Las fuentes fueron proporcionadas por el usuario; su autorización de uso web debe verificarse antes de publicar.

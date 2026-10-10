# Mi sucursal — hackathon Softtek

Frontend responsive en español para administrar ventas, existencias, promociones y demanda. Una misma web para computadora, Android e iPhone, con identidad Softtek y Helvetica Neue. El backend Spring Boot vive en el repositorio del equipo y se conecta mediante REST.

## Ejecutar la interfaz

Requiere Node.js 20.19+ o 22.12+ y npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Abre la dirección que imprime Vite, normalmente `http://localhost:5173`. El modo demostración está activado en el ejemplo. Puedes agregar existencias, registrar ventas, activar promociones y revisar demanda. Los datos simulados viven en memoria y se restablecen al recargar.

## Conectar Spring Boot

Cuando el equipo tenga su API funcionando, cambia `.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_USE_MOCKS=false
```

Reinicia Vite después de modificar el archivo. El backend debe permitir por CORS el origen del frontend (por ejemplo `http://localhost:5173`) y responder con los cuerpos acordados en OpenAPI. En producción ambas aplicaciones necesitan HTTPS. Las variables `VITE_*` son públicas: no colocar contraseñas ni claves allí.

Los repositorios permanecen separados. Para integrar se comparte la URL de Spring Boot y el contrato de rutas/JSON; no se copia su código al frontend. Las rutas vienen del documento original. Los DTO y reglas añadidos a OpenAPI siguen siendo una propuesta pendiente de revisión con el equipo.

## Comprobar y compilar

```sh
npm test
npm run build
npm run preview
```

`npm run api:types` regenera `src/api-schema.d.ts` después de cambiar el contrato. El hosting de producción debe servir `index.html` como fallback para rutas como `/inventario`.

El manifest y los iconos están preparados. El worker de producción guarda solo la interfaz estática y se activa con mocks deshabilitados. Las operaciones requieren conexión; no se guardan ventas pendientes offline. La instalación PWA aún necesita comprobarse en Android e iPhone reales.

## Estructura y documentos

- `src/App.tsx`: navegación y layout compartido.
- `src/pages/`: Inicio, Productos, Promociones, Demanda y Ajustes.
- `src/api.ts` y `src/api-schema.d.ts`: cliente REST y tipos del contrato.
- `src/mocks.ts` y `src/demo.ts`: API y datos de ejemplo, sin un servidor backend local.
- `src/styles.css` y `public/`: estilos, fuentes, logo y PWA.
- [Plan de producto e integración](docs/PLAN.md).
- [Catálogo de endpoints](docs/API.md).
- [Contrato OpenAPI del MVP](contracts/openapi.json).
- [Criterios de diseño y marca](docs/DISENO.md).

Stack implementado: React, TypeScript, Vite, React Router, TanStack Query, CSS con Tailwind, iconos Lucide y mocks MSW. Las gráficas usan SVG con tablas accesibles; no necesitan otra librería.

Esta versión no incluye autenticación, importaciones masivas ni algoritmos reales de IA. Las recomendaciones son ejemplos identificados como demostración. Los resultados de promociones se calculan con las ventas registradas en la demo. Las fuentes fueron proporcionadas por el usuario; su autorización de uso web debe verificarse antes de publicar.

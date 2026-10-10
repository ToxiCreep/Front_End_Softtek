# Plan de frontend y PWA

Fecha: 9 de octubre de 2026. Base: tablas y endpoints compartidos por el usuario.

Estado de implementación: primera interfaz disponible en `src/`, con cinco pantallas, API simulada y navegación responsive. El stack definitivo, comandos y estructura real están en README.md. Las gráficas se resolvieron con SVG y tabla accesible; Recharts y la estructura por features de este plan no fueron necesarios para el MVP.

## 1. Objetivo y alcance

Dar al gerente de una sucursal una forma de detectar riesgos de inventario, revisar demanda y aceptar promociones con explicación y margen estimado. La demo debe contar esta historia: **detectar un problema → revisar recomendación → decidir → ver el cambio registrado**.

Confirmado por el usuario: Spring Boot con API REST y PWA para celular y computadora. Se propone una instalación de una sola sucursal, moneda MXN, idioma español y datos sintéticos. Duración del hackathon, disponibilidad del equipo, hosting y autenticación siguen pendientes; el orden de trabajo se expresa por entregables, sin inventar fechas de entrega.

## 2. Plataforma

| Alternativa | Cobertura | Trabajo adicional | Decisión |
| --- | --- | --- | --- |
| Web responsive | Navegador en Android, iOS y escritorio | Adaptación de pantallas | Base de la aplicación |
| PWA sobre esa web | La misma web con icono y apertura independiente cuando se instala | Manifest, iconos, HTTPS y estrategia de caché | Elegida |
| Empaquetar con Capacitor | Aplicación distribuible para Android/iOS reutilizando la web | Proyectos nativos, builds, firma y pruebas por plataforma | Solo si después se exige APK o tiendas |
| Aplicación nativa separada | Android; otra entrega para cubrir iOS | Otra interfaz, builds y ciclo de distribución | Fuera del MVP |

La PWA se usa directamente con un enlace; instalarla es opcional. En iPhone puede añadirse desde Safari a la pantalla de inicio; la experiencia de instalación depende del navegador y sistema. [Apple](https://support.apple.com/es-es/guide/iphone/iphea86e5236/27/ios/27), [web.dev](https://web.dev/learn/pwa/installation).

Capacitor permite incorporar una web existente en proyectos Android e iOS, pero requiere preparar y probar cada plataforma. Es una opción futura, no una segunda aplicación para desarrollar en paralelo durante esta fase. [Documentación de Capacitor](https://capacitorjs.com/docs).

### Comportamiento móvil y sin conexión

- Misma lógica y API para todos los dispositivos. Navegación inferior en móvil; barra lateral en escritorio.
- Tarjetas para alertas y promociones; tablas con una presentación adaptada en móvil.
- Formularios y gráficas legibles desde 360 px; no depender de hover para ejecutar acciones.
- Manifest con nombre, iconos, `start_url` y `display: standalone`; verificar instalación en Android e iPhone reales, además del navegador.
- Service worker de producción: guardar recursos estáticos de la interfaz. Las peticiones `/api/v1` usan la red; ventas, stock y promociones deben mantenerse actualizados.
- Sin conexión: mostrar estado de desconexión y bloquear escrituras. El shell puede abrir si fue guardado previamente; el MVP no promete operar ventas offline.
- MSW y el worker de la PWA se habilitan en entornos separados: mocks en desarrollo o demo explícita, worker PWA en producción. Evitar registros que compitan por el mismo scope.

## 3. Tecnologías

| Capa | Propuesta | Motivo |
| --- | --- | --- |
| Interfaz | React + TypeScript | Componentes reutilizables y DTO tipados |
| Desarrollo/build | Vite, plantilla `react-ts` | Proyecto SPA sencillo; el backend ya existe aparte |
| Rutas | React Router, modo declarativo | Dashboard, inventario, promociones, demanda y ajustes |
| Estilos | Tailwind CSS | Diseño responsive consistente |
| Estado de API | TanStack Query | Consultas, errores, invalidación y actualización tras mutaciones |
| HTTP | `fetch` detrás de un cliente único | URL, timeout y normalización de errores en un lugar |
| Gráficas | Recharts, propuesta a validar al implementar | Ventas diarias y comparación BASE/IA; tablas como alternativa accesible |
| Mocks | MSW | Simular la API sin cambiar el código que la consume |
| Contrato | OpenAPI + generación de tipos TypeScript | Un acuerdo versionado compartido entre repositorios |
| PWA | Manifest + service worker; integración concreta al iniciar | Instalación y caché limitada al shell |
| Verificación | Vitest/Testing Library y Playwright donde aporten prueba del flujo | Errores de negocio, mutaciones y recorrido de demo |
| Backend confirmado | Spring Boot REST | Dueño de reglas, datos y transacciones |
| Persistencia/motor | Los define el equipo backend/algoritmos | El frontend consume DTO; no depende de la base ni de Python |

No se fijan versiones ni se añaden librerías antes de implementar. No se requiere Redux para este alcance: el estado remoto vive en Query y el estado local en React.

Referencias: [Vite](https://vite.dev/guide/), [React Router](https://reactrouter.com/start/declarative/installation), [Tailwind con Vite](https://tailwindcss.com/docs/installation/using-vite), [TanStack](https://tanstack.com/libraries/react), [MSW](https://mswjs.io/docs/).

## 4. Pantallas y API que las desbloquea

| Pantalla | Contenido y acción principal | Endpoints MVP |
| --- | --- | --- |
| Inicio `/` | Ingresos, margen bruto, pérdidas, ticket promedio y tendencia | `GET /dashboard/resumen`, `GET /ventas/resumen` |
| Inventario `/inventario` | Buscar productos, ver semáforo, cobertura y alertas; registrar entrada/merma | `GET /productos`, `GET /productos/categorias`, `GET /productos/{id}`, `GET /inventario/estado`, `GET /inventario/alertas`, `GET /inventario/reabasto`, `POST /inventario/movimientos` |
| Promociones `/promociones` | Generar sugerencias, leer explicación, activar/rechazar y consultar resultado | `GET /promociones`, `POST /promociones/generar`, `PATCH /promociones/{id}/estado`, `GET /promociones/{id}/resultado` |
| Demanda `/demanda` | Seleccionar producto/horizonte y comparar BASE vs. IA | `GET /predicciones`, `POST /predicciones/generar`, `GET /predicciones/comparar` |
| Ajustes `/ajustes` | Mostrar sucursal y cambiar IA con confirmación del servidor | `GET /configuracion`, `PATCH /configuracion/ia` |
| Venta de prueba, dentro de inventario | Registrar ticket para demostrar descuento y disminución de stock | `POST /ventas` |

Las cargas de productos, históricos y contexto son herramientas del equipo de datos; no requieren pantallas en el MVP. Empleados, calendario, mantenimiento completo de catálogos, precisión de modelos y records quedan para P1.

Cada pantalla incluye carga, vacío, error y reintento. Mientras se envía una mutación se deshabilita su botón; el cambio se muestra al recibir éxito del servidor. Tras ventas o movimientos se invalidan inventario, productos y dashboard; tras aceptar promociones se invalidan promociones y su resultado; tras generar demanda se invalidan predicciones, comparación y reabasto.

## 5. Arquitectura y repositorios independientes

```text
PWA React (tu repositorio)
          │ HTTPS /api/v1, JSON
          ▼
Spring Boot (repositorio del equipo)
          ├── Base de datos
          └── Motor BASE/IA (en proceso o servicio interno)
```

El navegador solo conoce Spring Boot. Credenciales del motor, claves de IA y base de datos permanecen en el backend. La variable pública propuesta `VITE_API_BASE_URL` incluye `/api/v1`; el cliente añade rutas como `/productos`. `VITE_USE_MOCKS` controla exclusivamente el modo simulado. Ninguna variable `VITE_*` es un secreto.

```text
src/
  app/                 # rutas, proveedores y layout
  features/
    dashboard/
    inventario/
    promociones/
    demanda/
    configuracion/
  shared/
    api/               # cliente fetch, tipos generados y errores
    ui/                # componentes reutilizables
  mocks/               # handlers y fixtures coherentes
public/                # manifest e iconos
contracts/openapi.json # copia versionada del contrato del MVP
```

Propuesta de colaboración:

1. Revisar juntos `docs/API.md` y `contracts/openapi.json`; adoptar una versión común, inicialmente `0.1.0`.
2. Designar un repositorio como fuente del contrato, preferentemente el del backend; mantener una copia con la misma versión en tu frontend.
3. El frontend genera tipos y mocks de esa versión. El backend implementa los DTO y errores acordados; la documentación generada desde Spring debe coincidir.
4. Cambios de campos/rutas se revisan como cambios de contrato antes de implementarlos en cada repo. Agregar opcionales puede ser compatible; renombrar, quitar o cambiar unidades requiere coordinación.
5. Compartir URL de API, orígenes permitidos por CORS, fixtures y fecha de corte de los datos. No es necesario fusionar repositorios ni compartir la base local.
6. Integrar contra un backend de prueba real antes de la demo. Un mock demuestra interfaz; no prueba la integración ni resultados del algoritmo.

Desarrollo local: configurar CORS para el origen real del frontend o un proxy de Vite. Despliegue: frontend y API con HTTPS, fallback SPA para rutas y CORS limitado a los orígenes acordados. El hosting se elige cuando el equipo confirme dónde expondrá la API. Si se requiere autenticación, acordar login/sesión, permisos y errores 401/403 antes de agregar un acceso real: el contrato actual es solo para una demo controlada con datos sintéticos.

## 6. Trabajo paralelo y orden de entrega

| Entregable | Tu frontend | Backend | Datos / algoritmos | Condición de cierre |
| --- | --- | --- | --- | --- |
| A. Contrato | Revisar DTO, filtros y respuestas | Adoptar contrato y reglas | Acordar fixtures y entradas al motor | Misma versión de OpenAPI |
| B. Base navegable | Layout responsive, rutas, cliente y mocks | Configuración, productos y cargas | Productos, históricos y contexto | Pantallas consumen mocks; datos coherentes |
| C. Lectura útil | Dashboard, inventario y alertas | Resumen, estado, pérdidas y dashboard | Predicciones BASE | Primer recorrido con API real |
| D. Decisiones | Promociones, demanda, switch IA, venta de prueba | Generaciones y mutaciones transaccionales | Motor IA y explicación | Aceptar promoción y vender actualiza stock |
| E. PWA y demo | Manifest, shell, pruebas móvil y escritorio | API accesible y CORS/HTTPS | Escenario reproducible | URL funciona en Android, iPhone y PC |

Criterio de parada: cuando el recorrido siguiente funciona con API real y el diseño se valida en las tres plataformas, cerrar el MVP. Agregar P1 solo con tiempo disponible.

## 7. Escenario de demo y aceptación

Fixtures propuestos: entre 10 y 20 productos de varias categorías, productos agotados y con exceso de stock, 8–12 semanas de ventas, contexto alineado y al menos una sugerencia de promoción. Los datos de ventas deben cuadrar con las métricas y fechas mostradas.

Recorrido:

1. Abrir Inicio y reconocer el periodo y fecha de corte.
2. Abrir una alerta de sobrestock; navegar al producto y su demanda.
3. Generar BASE y, con IA habilitada y disponible, comparar contra IA con la misma fecha objetivo.
4. Generar promociones; leer motivo, explicación y margen esperado.
5. Activar una sugerencia vigente, registrar una venta y verificar descuento, stock y métricas reales.
6. Abrir la misma URL en móvil y demostrar instalación opcional.

Pruebas necesarias: rechazo 422 por stock insuficiente sin venta parcial, transición inválida 409, switch IA confirmado por servidor, venta con promo vigente, filtros de fechas con zona horaria y actualizaciones de pantalla tras mutar. Verificar además estados vacíos/errores, rutas recargadas y operación desde Safari iOS y Chrome Android.

Una comparación de predicciones futuras no demuestra precisión. Solo presentar mejoras de error cuando haya evaluación histórica reproducible con ambos modelos, datos reales o sintéticos identificados y sin usar ventas futuras para entrenar. No presentar ahorro esperado como ahorro obtenido.

## 8. Decisiones que debe revisar el equipo

- Aceptar unidades de porcentajes, fechas, dinero y filtros propuestas en API.md.
- Confirmar alcance de autenticación y URL de integración.
- Confirmar si el motor responde dentro del límite de espera de la demo; si requiere trabajos asíncronos, cambiar juntos el contrato antes de implementar.
- Adoptar las correcciones de datos: IDs, `activo`, costo histórico por venta y política de devoluciones.
- Para predicción de caducidad: usar lotes o mostrar estimación explícita; no afirmar unidades reales en riesgo con el esquema actual.
- Acordar duración disponible para elegir qué rutas P1 realmente se construyen.

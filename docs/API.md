# Contrato de API e integración

Versión propuesta: `0.1.0`. Spring Boot REST confirmado. Las reglas nuevas que resuelven ambigüedades del texto original son propuestas para acordar con el equipo, no decisiones ya tomadas por el backend.

`contracts/openapi.json` define los esquemas de **P0**. El catálogo de este documento también incluye **P1**, cuyos cuerpos y respuestas deben incorporarse al OpenAPI antes de construir esas funciones. P0 = demo principal y carga de datos; P1 = ampliación.

## 1. Convenciones comunes

| Tema | Acuerdo propuesto |
| --- | --- |
| Base | `/api/v1`; JSON `camelCase`; enums en MAYÚSCULAS |
| Identificadores | `id` entero positivo para entidades; FK como `productoId`. Contexto se identifica por fecha |
| Dinero | MXN, números JSON con hasta dos decimales; BigDecimal y redondeo HALF_UP en backend. El frontend solo formatea |
| Porcentajes | Todos en escala 0–100: `margenMinimoPromo: 20` significa 20%; `descuentoMaximo: 30` significa 30% |
| Fechas | `YYYY-MM-DD`; horas `HH:mm`; instantes RFC 3339 con offset, por ejemplo `2026-10-09T14:30:00-06:00` |
| Zona horaria | Agregar `zonaHoraria` IANA a configuración; propuesta `America/Monterrey`. `zona` sigue siendo descripción geográfica |
| Intervalos | `desde` y `hasta` son fechas locales inclusivas. Backend filtra desde comienzo de `desde` hasta comienzo del día siguiente a `hasta`, exclusivo. Rechazar `desde > hasta` con 400 |
| Listas | Arreglo directo; una lista vacía devuelve `[]` con 200 |
| Paginación | Solo ventas y movimientos: `page=0`, `size=50`, máximo 200. Respuesta `{ content, page, size, totalElements, totalPages }`; orden por fecha descendente y desempate por id descendente |
| Filtros | Omitidos = sin filtro. Booleanos `true`/`false`; no enviar cadenas vacías. IDs inexistentes al filtrar listas devuelven lista vacía |
| Altas | 201 y recurso creado; cargas masivas 201 con `{ creados }` |
| Mutaciones | 200 con recurso actualizado, 204 sin cuerpo en DELETE. GET nunca muta |
| Errores | 400 formato/filtro, 404 recurso individual, 409 duplicado/transición/conflicto, 422 regla de negocio, 503 motor no disponible |
| Estado IA | `AUTO`: BASE si IA apagada, IA si encendida. Solicitar IA o AMBOS con IA apagada → 422. Fallo del motor IA → 503, sin etiquetar BASE como IA |

El mes histórico usa **meses**: corregir la descripción original que habla de días. Porcentajes propuestos modifican la fórmula del texto: precio mínimo de promo = `costo × (1 + margenMinimoPromo / 100)`.

Error común:

```json
{
  "status": 422,
  "error": "REGLA_NEGOCIO",
  "mensaje": "Stock insuficiente para registrar la venta",
  "campos": { "lineas[0].cantidad": "Disponible: 1" }
}
```

`campos` es siempre un objeto; puede estar vacío. Propuesta de límite de demo: hasta 1,000 registros por carga masiva, generación de hasta 31 días y 200 productos; límites rebasados → 422. Cada carga es atómica: si falla una fila, ninguna queda insertada. Productos vacíos en generación significa todos los activos; si excede 200, pedir una selección.

## 2. Catálogo completo

### Configuración

| Método | Ruta | Propósito | Prioridad |
| --- | --- | --- | --- |
| GET | `/configuracion` | Configuración única; creada por backend al arrancar | P0 |
| PUT | `/configuracion` | Reemplazar campos editables | P1 |
| PATCH | `/configuracion/ia` | `{ "iaHabilitada": true }`; devuelve configuración actualizada | P0 |

Horario de apertura menor que cierre; `mesesHistorico` y `transaccionesPorEmpleadoHora` ≥ 1. Para MVP se asume jornada dentro del mismo día; horario nocturno requiere otro acuerdo.

### Productos

| Método | Ruta / filtros | Propósito | Prioridad |
| --- | --- | --- | --- |
| GET | `/productos?categoria=&q=&perecedero=&bajoStock=` | Productos activos; `bajoStock` compara contra `stockMinimo` | P0 |
| GET | `/productos/{id}` | Producto individual | P0 |
| GET | `/productos/sku/{sku}` | Consulta por SKU codificado en URL | P1 |
| GET | `/productos/categorias` | Arreglo de categorías de productos activos | P0 |
| POST | `/productos` | Alta con stock inicial | P1 |
| POST | `/productos/lote` | Arreglo de altas con stock inicial | P0 |
| PUT | `/productos/{id}` | Editar catálogo; prohíbe `stockActual` | P1 |
| DELETE | `/productos/{id}` | Desactivar y devolver 204 | P1 |

Agregar `activo`, ausente en la tabla original. SKU único, precioVenta > costo → 422; stock inicial ≥ 0; stockMinimo ≤ stockMaximo; vidaUtilDias ≥ 1 si esPerecedero. Stock inicial se registra como ENTRADA con motivo de apertura para conservar trazabilidad. GET individual puede devolver un producto inactivo para mostrar referencias históricas; listas excluyen inactivos.

### Ventas

| Método | Ruta / filtros | Propósito | Prioridad |
| --- | --- | --- | --- |
| GET | `/ventas?desde=&hasta=&productoId=&empleadoId=&promocionId=&page=&size=` | Líneas paginadas | P1 |
| GET | `/ventas/ticket/{ticket}` | Líneas de un ticket | P1 |
| POST | `/ventas` | Registrar ticket completo y actualizar stock | P0 |
| POST | `/ventas/lote` | Importar líneas históricas sin modificar stock | P0 |
| GET | `/ventas/resumen?desde=&hasta=&agrupar=` | Series agregadas | P0 |
| GET | `/ventas/records?desde=&hasta=` | Mejor día/hora/producto/empleado | P1 |

`agrupar`: `dia`, `semana`, `mes`, `hora`, `diaSemana`, `producto`, `categoria`. Días/meses como fechas; semana empieza lunes y se identifica con su fecha; horas `00`–`23`; día de semana ISO `1`–`7`. Producto/categoría incluyen `productoId`/`categoria` y `nombre`; `periodo` es su identificador textual. En series de tiempo no hay filas sin actividad: el frontend puede completar el eje con cero. Tickets se cuentan DISTINCT por grupo; no sumar tickets de grupos producto/categoría como total de tickets.

Registrar venta:

```json
{
  "ticket": "T-000123",
  "fechaHora": "2026-10-09T14:30:00-06:00",
  "empleadoId": null,
  "lineas": [{ "productoId": 10, "cantidad": 2 }]
}
```

Reglas propuestas: `precioUnitario` opcional representa precio de lista antes de promo; el backend valida margen, calcula descuento monetario **total por línea**, llena promocionId y guarda costoUnitario al vender. Venta completa dentro de una transacción; stock insuficiente rechaza todo con 422. El backend asigna `lineaTicket` 1..N; agrupa cantidades para comprobar stock incluso si un producto se repite. Ticket ya registrado → 409, sin descontar de nuevo; el cliente conserva el ticket al reintentar y no reintenta POST automáticamente.

Carga histórica: arreglo de líneas con ticket, lineaTicket, fechaHora, productoId, cantidad, precioUnitario, **costoUnitario histórico**, descuentoAplicado, promocionId y empleadoId. No inferir costos pasados con el costo actual ni aplicar promos actuales. Clave única `(ticket, lineaTicket)`; duplicados en el lote o ya existentes → 409, sin inserciones parciales. No aceptar un ticket ya usado por una venta en vivo. Si faltan costos de origen, acordar cómo etiquetar estimaciones antes de importar.

### Inventario

| Método | Ruta / filtros | Propósito | Prioridad |
| --- | --- | --- | --- |
| GET | `/inventario/movimientos?productoId=&tipo=&desde=&hasta=&page=&size=` | Historial paginado | P1 |
| POST | `/inventario/movimientos` | Movimiento y stock en una transacción | P0 |
| GET | `/inventario/estado` | Stock, umbrales, cobertura y semáforo por producto | P0 |
| GET | `/inventario/alertas` | Arreglo de alertas; un producto puede tener varias | P0 |
| GET | `/inventario/reabasto` | Cantidades sugeridas desde la última corrida de predicción | P0 |
| GET | `/inventario/perdidas?desde=&hasta=` | Pérdidas realizadas por merma/caducidad, por tipo y categoría | P0 |

```json
{
  "productoId": 10,
  "tipo": "ENTRADA",
  "cantidad": 20,
  "motivo": "Recepción de proveedor"
}
```

Cantidad entera positiva para ENTRADA, DEVOLUCION, MERMA y CADUCIDAD; AJUSTE acepta entero firmado distinto de cero. ENTRADA/DEVOLUCION suman; MERMA/CADUCIDAD restan; AJUSTE suma el valor firmado. No permitir stock negativo. `costoTotal` siempre es magnitud no negativa; si se omite se calcula con `abs(cantidad) × costo`. Las pérdidas solo suman MERMA y CADUCIDAD. Un movimiento DEVOLUCION representa retorno físico: **no registra un reembolso** ni modifica ingresos en el MVP.

`diasCobertura` = stockActual / demandaDiariaEstimada; demanda desconocida o cero → null. `puntoReorden` procede del motor o, sin predicción, stockMinimo. Semáforo: AGOTADO con cero, BAJO_STOCK si stock < puntoReorden, SOBRESTOCK si stock > stockMaximo, NORMAL en otro caso; configuración debe mantener stockMaximo ≥ puntoReorden para evitar umbrales contradictorios.

Sin tabla de lotes, `POR_CADUCAR` solo puede mostrarse como **estimación**: incluir `estimada: true`, mensaje explicativo y unidadesEnRiesgo nullable. No hay evidencia para afirmar unidades exactas ni caducidad real a partir de la última entrada. Sin entradas/vida útil, no emitir esta alerta. Para cantidades reales se necesitan lotes con caducidad y saldo.

Reabasto: tomar la predicción vigente más reciente por producto y modelo resuelto por el switch, para la fecha objetivo del plan; no sumar `cantidadAPedir` de cada día, que podría duplicar pedidos. Mostrar `fechaObjetivo` y `generadaEn`. El algoritmo debe acordar horizonte/cobertura; sin recomendación calculada, devolver `[]`, no inventar una compra. No existe endpoint de orden de compra: la UI presenta sugerencias y permite registrar una entrada efectivamente recibida.

### Empleados

| Método | Ruta / filtros | Propósito | Prioridad |
| --- | --- | --- | --- |
| GET | `/empleados?rol=&activo=` | Lista | P1 |
| GET | `/empleados/{id}` | Detalle | P1 |
| POST | `/empleados` | Crear | P1 |
| PUT | `/empleados/{id}` | Actualizar | P1 |
| PATCH | `/empleados/{id}/activo` | `{ "activo": false }` | P1 |

Roles: CAJERO, PISO, ALMACEN, GERENTE. Sin eliminación física por referencias de ventas.

### Plantillas

| Método | Ruta / filtros | Propósito | Prioridad |
| --- | --- | --- | --- |
| GET | `/plantillas?diaSemana=&rol=&origen=` | Bloques | P1 |
| GET | `/plantillas/semana` | Calendario agrupado | P1 |
| POST | `/plantillas` | Crear bloque MANUAL | P1 |
| PUT | `/plantillas/{id}` | Editar bloque | P1 |
| DELETE | `/plantillas/{id}` | Borrar, 204 | P1 |
| POST | `/plantillas/recomendar?semanas=4&guardar=false` | Vista previa o reemplazo de recomendaciones | P1 |
| GET | `/plantillas/cobertura` | Déficit por rol | P1 |

Día ISO 1=lunes, 7=domingo; bloques dentro del horario. Conflictos del mismo día y rol → 409. Guardar debe preservar manuales y segmentar/excluir sus intervalos al generar recomendaciones para no producir traslapes; definir este comportamiento antes de implementar. Tickets/hora sustenta CAJERO; para PISO/ALMACEN/GERENTE faltan reglas por rol. Empleados activos no demuestran disponibilidad por hora: la cobertura es capacidad teórica, no un horario asignado.

### Promociones

| Método | Ruta / filtros | Propósito | Prioridad |
| --- | --- | --- | --- |
| GET | `/promociones?estado=&origen=&motivo=&productoId=&vigentes=` | Lista con explicación | P0 |
| GET | `/promociones/{id}` | Detalle | P1 |
| POST | `/promociones` | Crear sugerencia MANUAL | P1 |
| PUT | `/promociones/{id}` | Editar solo SUGERIDA | P1 |
| PATCH | `/promociones/{id}/estado` | `{ "estado": "ACTIVA" }` | P0 |
| POST | `/promociones/generar` | Crear y persistir sugerencias | P0 |
| GET | `/promociones/{id}/resultado` | Ventas y margen observado, esperado y ROI si se dispone | P0 |

Cuerpo propuesto de generar: `{ "productoIds": [10], "modelo": "AUTO" }`; ids omitidos o `[]` = todos los activos. AUTO/BASE/IA; BASE produce origen ALGORITMO, IA produce origen IA. Devolver 201 con el arreglo creado. Generaciones repetidas deben reutilizar sugerencias equivalentes o excluirlas, sin multiplicarlas; acordar criterio de equivalencia por producto/tipo/valor/intervalo.

Estados: SUGERIDA → ACTIVA/RECHAZADA; ACTIVA → FINALIZADA. Las demás transiciones, incluso al mismo estado, → 409. Activar revalida costo/margen, límites y fechas sin solapamiento. `vigentes=true` = ACTIVA cuyo intervalo inclusivo contiene la fecha local actual; `false` = complemento. Una ACTIVA expirada deja de aplicarse aunque aún no haya pasado a FINALIZADA.

Tipo PORCENTAJE: valor 0–100. PRECIO_FIJO: valor es MXN por unidad. DOS_X_UNO: valor=2, descuento solo a pares; una unidad suelta conserva su precio. Evaluar margen mínimo sobre el precio efectivo de las unidades promocionadas; un 2x1 puede violar el margen o el descuento máximo y debe rechazarse. `ventasEsperadas`/`ventasReales` expresan unidades. `gananciaEsperada` se define como margen bruto esperado, no utilidad neta.

Ingresos observados no equivalen a impacto incremental. `/resultado` devuelve roi=null mientras no exista una base de comparación y una fórmula acordada; la UI no presenta ROI inventado ni ahorro realizado a partir de expectativas. `ventasReales` se deriva de ventas con promocionId; costo histórico garantiza consistencia de margen.

### Predicciones

| Método | Ruta / filtros | Propósito | Prioridad |
| --- | --- | --- | --- |
| POST | `/predicciones/generar` | Guardar una corrida | P0 |
| GET | `/predicciones?productoId=&desde=&hasta=&modelo=` | Última predicción por producto/fecha/modelo dentro del filtro | P0 |
| GET | `/predicciones/precision?desde=&hasta=&modelo=` | Evaluación histórica y tamaño de muestra | P1 |
| GET | `/predicciones/comparar?productoId=&desde=&hasta=` | BASE/IA y ventas observadas para gráfica | P0 |

```json
{ "dias": 7, "productoIds": [10, 22], "modelo": "AMBOS" }
```

AUTO/BASE/IA/AMBOS al generar; BASE/IA para filtrar guardadas. La fecha objetivo comienza mañana en zona de sucursal; dias entre 1 y 31. Respuesta 201 `{ generadaEn, predicciones }`. Generación sincrónica propuesta; frontend permite esperar hasta 60 s y no reintenta POST automáticamente. Si la latencia no cabe, diseñar en otra versión `202 + trabajoId` y consulta de estado; no mezclar ambas formas de respuesta sin contrato.

Intervalos inferior/superior pueden ser null cuando el modelo no los proporciona. Comparación devuelve una fila por fecha con BASE/IA nullable si falta un modelo; ventasReales=null para fechas aún no cerradas, 0 para días cerrados sin ventas. Para comparar, ambos modelos deberían provenir de la misma corrida (usar generadaEn compartida), mismo corte e historia; no mezclar corridas distintas sin indicarlo. Si existe solo un modelo, mostrarlo como comparación incompleta.

Precisión futura: excluir días no cerrados; MAPE no está definido cuando ventas reales=0. Propuesta: excluir esos puntos del MAPE, devolver nEvaluados y nExcluidos y usar una métrica complementaria acordada. Sin muestra, mape=null. Para evaluar sin fuga de datos hacen falta predicciones generadas antes de la fecha objetivo o backtesting; no generar hoy predicciones de ayer con historia de hoy.

### Contexto

| Método | Ruta / filtros | Propósito | Prioridad |
| --- | --- | --- | --- |
| GET | `/contexto?desde=&hasta=` | Contexto por fecha | P1 |
| GET | `/contexto/{fecha}` | Un día | P1 |
| PUT | `/contexto/{fecha}` | Crear o actualizar; 201/200 según existencia | P1 |
| POST | `/contexto/lote` | Cargar arreglo de días nuevos, duplicados → 409 | P0 |
| POST | `/contexto/generar?anio=2026` | Crear datos calculados | P1 |

Contexto climático opcional y nullable. `/generar` requiere calendario verificado del país y reglas explícitas de temporadas; preservar entradas manuales o acordar sustitución. No asumir que el endpoint existe ni que obtiene clima automáticamente.

### Dashboard

| Método | Ruta / filtros | Propósito | Prioridad |
| --- | --- | --- | --- |
| GET | `/dashboard/resumen?desde=&hasta=` | KPIs, desglose de promociones y comparación | P0 |

Requiere desde/hasta. Periodo anterior: misma cantidad de días locales inmediatamente antes de desde. Ingresos = suma(cantidad × precioUnitario − descuentoAplicado); costo = suma(cantidad × costoUnitario guardado); margen = ingresos − costo; ticketPromedio = ingresos/tickets distintos, cero si no hay tickets. Pérdidas se informan aparte del margen bruto. Variación porcentual = `(actual − anterior)/abs(anterior) × 100`; anterior=0 → null. Incluye fecha de generación de respuesta y periodo anterior para rotular la UI.

## 3. Formas de respuesta clave

Los campos exactos están en OpenAPI. Ejemplos ilustrativos de forma, no resultados medidos:

```json
[
  {
    "periodo": "2026-10-01",
    "unidades": 340,
    "ingresos": 8420.5,
    "costo": 5100,
    "margen": 3320.5,
    "tickets": 112
  }
]
```

Comparación incompleta:

```json
[
  {
    "fecha": "2026-10-10",
    "productoId": 10,
    "base": { "cantidadPredicha": 25, "generadaEn": "2026-10-09T20:30:00Z" },
    "ia": null,
    "ventasReales": null
  }
]
```

Estado de inventario sin demanda calculada:

```json
[
  {
    "productoId": 10,
    "sku": "BEB-COCA-600",
    "nombre": "Bebida 600 ml",
    "categoria": "BEBIDAS",
    "stockActual": 12,
    "stockMinimo": 20,
    "stockMaximo": 120,
    "puntoReorden": 20,
    "diasCobertura": null,
    "semaforo": "BAJO_STOCK"
  }
]
```

## 4. Correcciones necesarias del modelo de datos

1. Agregar PK id a entidades y `activo` a productos. Guardar `zonaHoraria`; documentar unidades de margen/porcentaje.
2. Guardar `costoUnitario` y `lineaTicket` en cada venta; agregar unicidad e integridad de ticket/línea. Cambiar costos del catálogo no debe alterar margen histórico.
3. DescuentoAplicado es importe total por línea, no porcentaje. Mantener precioUnitario antes del descuento para evitar descontar dos veces.
4. Caducidad requiere lotes para exactitud. Mientras tanto, las alertas son estimadas y no deben afirmar unidades verificadas.
5. Agregar corrida/corte identificable en predicciones, aunque no se exponga un nuevo recurso; `generadaEn` compartida permite agrupar el MVP. Conservar historial para evaluación, pero GET del frontend devuelve última corrida relevante.
6. Guardar o producir `explicacion` de promoción, ausente en la tabla pero necesaria para la pantalla.
7. Devolución física no basta para reversar dinero. Reembolsos y anulaciones financieros quedan fuera del MVP hasta definir sus registros y vínculos.

## 5. Responsabilidad por contrato

| Responsable | Entrega |
| --- | --- |
| Frontend | Rutas, componentes, accesibilidad, mocks, estados de carga/error y consumo de DTO; no decide stock, precios finales ni estados válidos |
| Spring Boot | CORS, validaciones, transacciones, DTO, agregados, promoción vigente y reglas de dinero/stock |
| Motor | Demanda, cobertura, cantidades de reabasto, incertidumbre disponible y sugerencias explicadas; respetar límites del backend |
| Datos | Fixtures con IDs/SKU/fechas/costos coherentes, importaciones históricas y contexto |

Si el motor es Python, Spring Boot lo consume mediante una API interna que el frontend no llama. Acordar entradas (historial diario, contexto, producto y corte) y salidas (predicción, intervalos, reabasto y explicación) entre esos dos equipos. Ese contrato interno es distinto del OpenAPI público de este repositorio.

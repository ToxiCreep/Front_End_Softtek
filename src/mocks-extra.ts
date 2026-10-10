import { http, HttpResponse } from 'msw'
import { shiftDate, today } from './api'
import type { Schema } from './api'
import { configuration, movements, products, promotions, sales } from './demo'
import type { CoberturaRol, Contexto, Empleado, Plantilla, Rol, SucursalActiva, Tamano } from './backend-types'
import { dias } from './backend-types'

/**
 * Datos de ejemplo para los endpoints que no estaban en contracts/openapi.json.
 * Responden con la forma de Spring Boot (src/backend-types.ts). Son simples a propósito:
 * su objetivo es que las pantallas nuevas funcionen con VITE_USE_MOCKS=true.
 */
const error = (mensaje: string, status = 422) => HttpResponse.json({ status, error: 'REGLA_NEGOCIO', mensaje, campos: {} }, { status })
const r2 = (n: number) => Math.round(n * 100) / 100

const base: SucursalActiva = { activa: 'MEDIANA', disponibles: ['PEQUENA', 'MEDIANA', 'GRANDE'] }
const empleados: Empleado[] = [
  { id: 1, nombre: 'Ana López', rol: 'CAJERO', costoHora: 62, horasMaxSemana: 48, activo: true },
  { id: 2, nombre: 'Luis Pérez', rol: 'CAJERO', costoHora: 60, horasMaxSemana: 40, activo: true },
  { id: 3, nombre: 'Marta Ruiz', rol: 'PISO', costoHora: 58, horasMaxSemana: 48, activo: true },
  { id: 4, nombre: 'Jorge Díaz', rol: 'ALMACEN', costoHora: 65, horasMaxSemana: 48, activo: true },
  { id: 5, nombre: 'Sofía Treviño', rol: 'GERENTE', costoHora: 110, horasMaxSemana: 48, activo: true },
]
const horas = (p: { horaInicio: string; horaFin: string }) => (Date.parse(`2000-01-01T${p.horaFin}`) - Date.parse(`2000-01-01T${p.horaInicio}`)) / 3600000
const bloque = (id: number, diaSemana: number, horaInicio: string, horaFin: string, rol: Rol, personalRequerido: number, origen: Plantilla['origen'] = 'RECOMENDADO'): Plantilla =>
  ({ id, diaSemana, dia: dias[diaSemana], horaInicio: `${horaInicio}:00`, horaFin: `${horaFin}:00`, rol, personalRequerido, origen, horasPersona: r2(horas({ horaInicio, horaFin }) * personalRequerido) })
let plantillas: Plantilla[] = [1, 2, 3, 4, 5, 6, 7].flatMap(d => [bloque(d * 10 + 1, d, '08:00', '14:00', 'CAJERO', d >= 6 ? 2 : 1), bloque(d * 10 + 2, d, '14:00', '21:00', 'CAJERO', 2), bloque(d * 10 + 3, d, '08:00', '16:00', 'PISO', 1)])
const contexto = new Map<string, Contexto>()
const dia = (fecha: string): Contexto => contexto.get(fecha) ?? { fecha, esFestivo: false, nombreEvento: null, esQuincena: ['15', '30'].includes(fecha.slice(8)), temporada: 'NORMAL', clima: null, temperatura: null }

function cobertura(): CoberturaRol[] {
  return (['CAJERO', 'PISO', 'ALMACEN', 'GERENTE'] as Rol[]).map(rol => {
    const requeridas = plantillas.filter(p => p.rol === rol).reduce((s, p) => s + p.horasPersona, 0)
    const activos = empleados.filter(e => e.rol === rol && e.activo)
    const disponibles = activos.reduce((s, e) => s + (e.horasMaxSemana ?? 48), 0)
    const faltantes = Math.max(0, Math.ceil((requeridas - disponibles) / 48))
    const estado: CoberturaRol['estado'] = requeridas === 0 && !activos.length ? 'SIN_DATOS' : faltantes > 0 ? 'DEFICIT' : disponibles < requeridas * 1.1 ? 'JUSTO' : requeridas > 0 && disponibles > requeridas * 1.5 ? 'EXCESO' : 'OK'
    return { rol, horasRequeridas: r2(requeridas), horasDisponibles: disponibles, deficitHoras: r2(Math.max(0, requeridas - disponibles)), picoSimultaneo: Math.max(0, ...plantillas.filter(p => p.rol === rol).map(p => p.personalRequerido)), empleadosActivos: activos.length, empleadosFaltantes: faltantes, estado }
  })
}
function lineas(desde?: string | null, hasta?: string | null) {
  const nombre = (id: number) => products.find(p => p.id === id)
  return sales.filter(s => (!desde || s.fecha >= desde) && (!hasta || s.fecha <= hasta)).map((s, i) => ({ id: i + 1, ticket: s.ticket, fechaHora: `${s.fecha}T12:00:00`, productoId: s.productoId, sku: nombre(s.productoId)?.sku ?? '', productoNombre: nombre(s.productoId)?.nombre ?? '',
    cantidad: s.cantidad, precioUnitario: s.precioUnitario, descuentoAplicado: s.descuentoAplicado, total: r2(s.cantidad * s.precioUnitario - s.descuentoAplicado), promocionId: s.promocionId, empleadoId: null }))
}

export function createExtraHandlers(endpoint: (path: string) => string) {
  return [
    http.get(endpoint('/sucursal-activa'), () => HttpResponse.json(base)),
    http.put(endpoint('/sucursal-activa'), async ({ request }) => { const { tamano } = await request.json() as { tamano: Tamano }; if (!base.disponibles.includes(tamano)) return error('Tamaño inválido.', 400); base.activa = tamano; return HttpResponse.json(base) }),
    http.put(endpoint('/configuracion'), async ({ request }) => { Object.assign(configuration, await request.json() as Partial<Schema['Configuracion']>); return HttpResponse.json(configuration) }),
    http.get(endpoint('/configuracion/ia/proveedores'), () => HttpResponse.json(['GEMINI', 'ANTHROPIC', 'OPENAI'])),
    http.get(endpoint('/configuracion/ia/estado'), () => HttpResponse.json({ proveedorConfigurado: ['NINGUNO', 'GEMINI', 'ANTHROPIC', 'OPENAI'][configuration.proveedorIA], modeloConfigurado: null, disponible: configuration.proveedorIA !== 0, registrados: ['ANTHROPIC', 'OPENAI', 'GEMINI'], conLlave: ['ANTHROPIC', 'OPENAI', 'GEMINI'], llamadas: 0, fallos: 0, ultimaOk: null, ultimaLatenciaMs: null, ultimoError: null })),

    http.get(endpoint('/empleados'), ({ request }) => { const q = new URL(request.url).searchParams; return HttpResponse.json(empleados.filter(e => (!q.get('rol') || e.rol === q.get('rol')) && (!q.get('activo') || String(e.activo) === q.get('activo')))) }),
    http.post(endpoint('/empleados/lote'), async ({ request }) => { const lote = await request.json() as Omit<Empleado, 'id'>[]; const nuevos = lote.map((e, i) => ({ activo: true, horasMaxSemana: 48, ...(e as Partial<Empleado>), id: empleados.length + i + 1 }) as Empleado); empleados.push(...nuevos); return HttpResponse.json(nuevos, { status: 201 }) }),
    http.post(endpoint('/empleados'), async ({ request }) => { const e = { activo: true, horasMaxSemana: 48, ...(await request.json() as Partial<Empleado>), id: empleados.length + 1 } as Empleado; empleados.push(e); return HttpResponse.json(e, { status: 201 }) }),
    http.put(endpoint('/empleados/:id'), async ({ params, request }) => { const e = empleados.find(e => e.id === Number(params.id)); if (!e) return error('No encontramos al empleado.', 404); Object.assign(e, await request.json()); return HttpResponse.json(e) }),
    http.patch(endpoint('/empleados/:id/activo'), async ({ params, request }) => { const e = empleados.find(e => e.id === Number(params.id)); if (!e) return error('No encontramos al empleado.', 404); e.activo = (await request.json() as { activo: boolean }).activo; return HttpResponse.json(e) }),

    http.get(endpoint('/plantillas/semana'), () => HttpResponse.json([1, 2, 3, 4, 5, 6, 7].map(d => { const b = plantillas.filter(p => p.diaSemana === d); return { diaSemana: d, dia: dias[d], horasPersona: r2(b.reduce((s, p) => s + p.horasPersona, 0)), bloques: b } }))),
    http.get(endpoint('/plantillas/cobertura'), () => HttpResponse.json(cobertura())),
    http.get(endpoint('/plantillas'), ({ request }) => { const q = new URL(request.url).searchParams; return HttpResponse.json(plantillas.filter(p => (!q.get('rol') || p.rol === q.get('rol')) && (!q.get('origen') || p.origen === q.get('origen'))).sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio))) }),
    http.post(endpoint('/plantillas/recomendar'), ({ request }) => {
      const guardar = new URL(request.url).searchParams.get('guardar') === 'true'
      const propuesta = [1, 2, 3, 4, 5, 6, 7].flatMap(d => [bloque(1000 + d * 10 + 1, d, '08:00', '14:00', 'CAJERO', d >= 5 ? 2 : 1), bloque(1000 + d * 10 + 2, d, '14:00', '21:00', 'CAJERO', d >= 5 ? 3 : 2), bloque(1000 + d * 10 + 3, d, '10:00', '18:00', 'PISO', 1)])
      if (guardar) plantillas = [...plantillas.filter(p => p.origen === 'MANUAL'), ...propuesta]
      const porRol = Object.fromEntries(['CAJERO', 'PISO'].map(rol => [rol, r2(propuesta.filter(p => p.rol === rol).reduce((s, p) => s + p.horasPersona, 0))]))
      return HttpResponse.json({ semanasAnalizadas: 4, transaccionesPorEmpleadoHora: configuration.transaccionesPorEmpleadoHora, guardado: guardar, bloques: propuesta, horasPersonaPorRol: porRol, costoSemanalEstimado: r2(porRol.CAJERO * 61 + porRol.PISO * 58), demandaPorHora: {}, notas: ['Datos de ejemplo: la propuesta real se calcula con los tickets por hora.'] })
    }),
    http.post(endpoint('/plantillas'), async ({ request }) => { const b = await request.json() as Plantilla; const p = bloque(Date.now(), b.diaSemana, b.horaInicio.slice(0, 5), b.horaFin.slice(0, 5), b.rol, b.personalRequerido, 'MANUAL'); plantillas.push(p); return HttpResponse.json(p, { status: 201 }) }),
    http.put(endpoint('/plantillas/:id'), async ({ params, request }) => { const i = plantillas.findIndex(p => p.id === Number(params.id)); if (i < 0) return error('No encontramos el bloque.', 404); const b = await request.json() as Plantilla; plantillas[i] = bloque(plantillas[i].id, b.diaSemana, b.horaInicio.slice(0, 5), b.horaFin.slice(0, 5), b.rol, b.personalRequerido, plantillas[i].origen); return HttpResponse.json(plantillas[i]) }),
    http.delete(endpoint('/plantillas/:id'), ({ params }) => { plantillas = plantillas.filter(p => p.id !== Number(params.id)); return new HttpResponse(null, { status: 204 }) }),

    http.get(endpoint('/ventas/records'), ({ request }) => {
      const q = new URL(request.url).searchParams
      const rows = lineas(q.get('desde'), q.get('hasta'))
      const ingresos = rows.reduce((s, r) => s + r.total, 0)
      const costo = rows.reduce((s, r) => s + r.cantidad * (products.find(p => p.id === r.productoId)?.costo ?? 0), 0)
      const tickets = new Set(rows.map(r => r.ticket)).size
      const porDia = new Map<string, number>(); rows.forEach(r => porDia.set(r.fechaHora.slice(0, 10), (porDia.get(r.fechaHora.slice(0, 10)) ?? 0) + r.total))
      const mejor = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0]
      const porProd = new Map<number, number>(); rows.forEach(r => porProd.set(r.productoId, (porProd.get(r.productoId) ?? 0) + r.cantidad))
      const estrella = products.find(p => p.id === [...porProd.entries()].sort((a, b) => b[1] - a[1])[0]?.[0])
      return HttpResponse.json({ desde: q.get('desde'), hasta: q.get('hasta'), totales: { ingresos: r2(ingresos), margen: r2(ingresos - costo), unidades: rows.reduce((s, r) => s + r.cantidad, 0), tickets, ticketPromedio: tickets ? r2(ingresos / tickets) : 0 },
        mejorDia: mejor ? { fecha: mejor[0], ingresos: r2(mejor[1]), tickets: new Set(rows.filter(r => r.fechaHora.startsWith(mejor[0])).map(r => r.ticket)).size } : null,
        mejorHora: { hora: 18, ingresos: r2(ingresos * 0.14), tickets: Math.round(tickets * 0.14), ticketsPromedioPorDia: 6.5 }, mejorDiaSemana: null,
        productoEstrella: estrella ? { productoId: estrella.id, sku: estrella.sku, nombre: estrella.nombre, unidades: porProd.get(estrella.id), ingresos: 0, margen: 0 } : null, productoMasRentable: null, mejorEmpleado: null, ticketMasAlto: null })
    }),
    http.get(endpoint('/ventas/ticket/:ticket'), ({ params }) => { const l = lineas().filter(r => r.ticket === params.ticket); if (!l.length) return error('No encontramos este ticket.', 404); const total = r2(l.reduce((s, r) => s + r.total, 0)); const descuento = r2(l.reduce((s, r) => s + r.descuentoAplicado, 0)); return HttpResponse.json({ ticket: params.ticket, fechaHora: l[0].fechaHora, empleadoId: null, lineas: l, subtotal: r2(total + descuento), descuento, total }) }),
    http.post(endpoint('/ventas/lote'), async ({ request }) => HttpResponse.json({ insertadas: (await request.json() as unknown[]).length }, { status: 201 })),
    http.get(endpoint('/ventas'), ({ request }) => { const q = new URL(request.url).searchParams; const page = Number(q.get('page') ?? 0), size = Number(q.get('size') ?? 50); const all = lineas(q.get('desde'), q.get('hasta')).reverse(); return HttpResponse.json({ contenido: all.slice(page * size, page * size + size), pagina: page, tamano: size, totalElementos: all.length, totalPaginas: Math.ceil(all.length / size) }) }),

    http.get(endpoint('/inventario/movimientos'), ({ request }) => { const id = Number(new URL(request.url).searchParams.get('productoId')); const p = products.find(p => p.id === id); const rows = movements.filter(m => !id || m.productoId === id).map(m => ({ ...m, sku: p?.sku, productoNombre: p?.nombre, efectoEnStock: ['MERMA', 'CADUCIDAD'].includes(m.tipo) ? -m.cantidad : m.cantidad })).reverse(); return HttpResponse.json({ contenido: rows, pagina: 0, tamano: rows.length, totalElementos: rows.length, totalPaginas: 1 }) }),
    http.post(endpoint('/inventario/movimientos/lote'), async ({ request }) => HttpResponse.json({ insertados: (await request.json() as unknown[]).length, afectoStock: new URL(request.url).searchParams.get('afectarStock') === 'true' }, { status: 201 })),

    http.get(endpoint('/productos/sku/:sku'), ({ params }) => { const p = products.find(p => p.sku.toLowerCase() === String(params.sku).toLowerCase()); return p ? HttpResponse.json(p) : error('No encontramos este producto.', 404) }),
    http.post(endpoint('/productos/lote'), async ({ request }) => { const lote = await request.json() as Schema['ProductoAlta'][]; const nuevos = lote.map((p, i) => ({ stockActual: 0, stockMinimo: 0, stockMaximo: 0, leadTimeDias: 2, esPerecedero: false, vidaUtilDias: null, ...(p as Partial<Schema['Producto']>), id: products.length + i + 1, activo: true }) as Schema['Producto']); products.push(...nuevos); return HttpResponse.json(nuevos, { status: 201 }) }),
    http.post(endpoint('/productos'), async ({ request }) => { const p = { stockActual: 0, stockMinimo: 0, stockMaximo: 0, leadTimeDias: 2, esPerecedero: false, vidaUtilDias: null, ...(await request.json() as Partial<Schema['Producto']>), id: products.length + 1, activo: true } as Schema['Producto']; if (products.some(x => x.sku === p.sku)) return error('Ya existe un producto con ese código.', 409); products.push(p); return HttpResponse.json(p, { status: 201 }) }),
    http.put(endpoint('/productos/:id'), async ({ params, request }) => { const p = products.find(p => p.id === Number(params.id)); if (!p) return error('No encontramos este producto.', 404); Object.assign(p, await request.json()); return HttpResponse.json(p) }),
    http.delete(endpoint('/productos/:id'), ({ params }) => { const i = products.findIndex(p => p.id === Number(params.id)); if (i >= 0) products.splice(i, 1); return new HttpResponse(null, { status: 204 }) }),

    http.get(endpoint('/promociones/:id'), ({ params }) => { const p = promotions.find(p => p.id === Number(params.id)); return p ? HttpResponse.json(p) : error('No encontramos esta promoción.', 404) }),
    http.post(endpoint('/promociones'), async ({ request }) => { const b = await request.json() as Schema['Promocion'] & { activar?: boolean }; const p: Schema['Promocion'] = { id: promotions.length + 1, productoId: b.productoId, tipo: b.tipo, valor: b.valor ?? 0, fechaInicio: b.fechaInicio, fechaFin: b.fechaFin, estado: b.activar ? 'ACTIVA' : 'SUGERIDA', origen: 'MANUAL', motivo: b.motivo ?? 'TEMPORADA', ventasEsperadas: 0, ventasReales: 0, gananciaEsperada: null, explicacion: b.explicacion ?? 'Promoción creada manualmente.' }; promotions.push(p); return HttpResponse.json(p, { status: 201 }) }),
    http.put(endpoint('/promociones/:id'), async ({ params, request }) => { const p = promotions.find(p => p.id === Number(params.id)); if (!p) return error('No encontramos esta promoción.', 404); const { activar: _a, ...b } = await request.json() as Schema['Promocion'] & { activar?: boolean }; Object.assign(p, b); return HttpResponse.json(p) }),

    http.get(endpoint('/predicciones/precision'), () => HttpResponse.json({ desde: shiftDate(today(), -30), hasta: shiftDate(today(), -1), modelos: [{ modelo: 'BASE', puntos: 120, mape: 24.1, wape: 21.3, sesgo: -2.1, precision: 78.7, porProducto: [] }] })),

    http.get(endpoint('/contexto/:fecha'), ({ params }) => { const c = contexto.get(String(params.fecha)); return c ? HttpResponse.json(c) : error(`No hay contexto para ${params.fecha}`, 404) }),
    http.get(endpoint('/contexto'), ({ request }) => { const q = new URL(request.url).searchParams; const desde = q.get('desde') ?? today(), hasta = q.get('hasta') ?? shiftDate(desde, 30); const rows: Contexto[] = []; for (let d = desde; d <= hasta; d = shiftDate(d, 1)) rows.push(dia(d)); return HttpResponse.json(rows) }),
    http.put(endpoint('/contexto/:fecha'), async ({ params, request }) => { const c = { ...await request.json() as Contexto, fecha: String(params.fecha) }; contexto.set(c.fecha, c); return HttpResponse.json(c) }),
    http.post(endpoint('/contexto/lote'), async ({ request }) => { const lote = await request.json() as Contexto[]; lote.forEach(c => contexto.set(c.fecha, { ...dia(c.fecha), ...c })); return HttpResponse.json(lote, { status: 201 }) }),
    http.post(endpoint('/contexto/generar'), ({ request }) => {
      const anio = Number(new URL(request.url).searchParams.get('anio')) || Number(today().slice(0, 4))
      const festivos: [string, string][] = [['01-01', 'Año Nuevo'], ['05-01', 'Día del Trabajo'], ['09-16', 'Independencia'], ['12-25', 'Navidad']]
      const rows = festivos.map(([md, nombre]) => ({ ...dia(`${anio}-${md}`), esFestivo: true, nombreEvento: nombre }))
      rows.forEach(c => contexto.set(c.fecha, c))
      return HttpResponse.json(rows, { status: 201 })
    }),
  ]
}

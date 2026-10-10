import { http, HttpResponse, delay } from 'msw'
import { apiBase, iaProviders, shiftDate, today } from '../../src/api'
import type { Schema } from '../../src/api'
import { alerts, changePromotion, changeStock, configuration, generatePredictions, inventoryState, movements, predictions, products, promotions, sales, summarize } from './demo'

const error = (mensaje: string, status = 422) => HttpResponse.json({ status, error: status === 409 ? 'CONFLICTO' : 'REGLA_NEGOCIO', mensaje, campos: {} }, { status })
const product = (id: number) => products.find(p => p.id === id)
const range = (request: Request) => {
  const params = new URL(request.url).searchParams
  return { desde: params.get('desde') || shiftDate(today(), -6), hasta: params.get('hasta') || today() }
}

// shortcut: demo en memoria; Spring Boot dará persistencia al conectar el backend.
export function createHandlers(base = apiBase) {
const endpoint = (path: string) => `${base}${path}`
return [
  http.get(endpoint('/configuracion'), async () => { await delay(180); return HttpResponse.json(configuration) }),
  http.patch(endpoint('/configuracion/ia'), async ({ request }) => {
    const body = await request.json() as Schema['CambioIA']
    if (!body || Object.keys(body).some(key => key !== 'proveedorIA') || !iaProviders.some(provider => provider.value === body.proveedorIA)) return error('Selecciona un proveedor válido: 0, 1, 2 o 3.', 400)
    configuration.proveedorIA = body.proveedorIA
    return HttpResponse.json(configuration)
  }),
  http.get(endpoint('/productos/categorias'), () => HttpResponse.json([...new Set(products.map(p => p.categoria))])),
  http.get(endpoint('/productos/:id'), ({ params }) => {
    const p = product(Number(params.id))
    return p ? HttpResponse.json(p) : error('No encontramos este producto.', 404)
  }),
  http.get(endpoint('/productos'), ({ request }) => {
    const query = new URL(request.url).searchParams
    const q = (query.get('q') || '').toLocaleLowerCase('es')
    return HttpResponse.json(products.filter(p => (!q || `${p.nombre} ${p.sku}`.toLocaleLowerCase('es').includes(q)) && (!query.get('categoria') || p.categoria === query.get('categoria'))))
  }),
  http.get(endpoint('/inventario/estado'), () => HttpResponse.json(inventoryState())),
  http.get(endpoint('/inventario/alertas'), () => HttpResponse.json(alerts())),
  http.get(endpoint('/inventario/reabasto'), () => HttpResponse.json(products.map(p => {
    const prediction = predictions.findLast(item => item.productoId === p.id && item.fechaObjetivo === shiftDate(today(), 1) && item.modelo === (configuration.proveedorIA ? 'IA' : 'BASE'))
    return prediction ? { productoId: p.id, sku: p.sku, nombre: p.nombre, stockActual: p.stockActual, stockRecomendado: prediction.stockRecomendado, cantidadAPedir: Math.max(0, prediction.stockRecomendado - p.stockActual), fechaObjetivo: prediction.fechaObjetivo, generadaEn: prediction.generadaEn, modelo: prediction.modelo } satisfies Schema['Reabasto'] : null
  }).filter(p => p && p.cantidadAPedir > 0))),
  http.get(endpoint('/inventario/perdidas'), ({ request }) => {
    const { desde, hasta } = range(request)
    const relevant = movements.filter(m => ['MERMA', 'CADUCIDAD'].includes(m.tipo) && m.fecha.slice(0, 10) >= desde && m.fecha.slice(0, 10) <= hasta)
    return HttpResponse.json({ desde, hasta, total: relevant.reduce((sum, m) => sum + m.costoTotal, 0),
      porTipo: ['MERMA', 'CADUCIDAD'].map(tipo => ({ tipo, unidades: relevant.filter(m => m.tipo === tipo).reduce((sum, m) => sum + m.cantidad, 0), importe: relevant.filter(m => m.tipo === tipo).reduce((sum, m) => sum + m.costoTotal, 0) })),
      porCategoria: [...new Set(relevant.map(m => product(m.productoId)!.categoria))].map(categoria => ({ categoria, unidades: relevant.filter(m => product(m.productoId)!.categoria === categoria).reduce((sum, m) => sum + m.cantidad, 0), importe: relevant.filter(m => product(m.productoId)!.categoria === categoria).reduce((sum, m) => sum + m.costoTotal, 0) })) })
  }),
  http.post(endpoint('/inventario/movimientos'), async ({ request }) => {
    const body = await request.json() as Schema['MovimientoSolicitud']
    const p = product(body.productoId)
    if (!p) return error('No encontramos este producto.', 404)
    if (!['ENTRADA', 'MERMA', 'CADUCIDAD', 'AJUSTE', 'DEVOLUCION'].includes(body.tipo) || !body.motivo?.trim()) return error('Completa el tipo y el motivo del movimiento.', 400)
    try {
      const stock = changeStock(p, body.tipo, body.cantidad)
      const movement: Schema['Movimiento'] = { id: movements.length + 1, ...body, motivo: body.motivo.trim(), fecha: new Date().toISOString(), costoTotal: Math.abs(body.cantidad) * p.costo, stockResultante: stock }
      p.stockActual = stock
      movements.push(movement)
      return HttpResponse.json(movement, { status: 201 })
    } catch (e) { return error((e as Error).message) }
  }),
  http.get(endpoint('/dashboard/resumen'), async ({ request }) => {
    await delay(200)
    const { desde, hasta } = range(request)
    const days = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1
    const anteriorDesde = shiftDate(desde, -days)
    const anteriorHasta = shiftDate(desde, -1)
    const actual = summarize(desde, hasta)
    const anterior = summarize(anteriorDesde, anteriorHasta)
    const variacionPorcentual = Object.fromEntries(Object.keys(actual).map(k => {
      const key = k as keyof typeof actual
      return [key, anterior[key] === 0 ? null : (actual[key] - anterior[key]) / Math.abs(anterior[key]) * 100]
    }))
    return HttpResponse.json({ periodo: { desde, hasta }, periodoAnterior: { desde: anteriorDesde, hasta: anteriorHasta }, actual, anterior, variacionPorcentual, generadoEn: new Date().toISOString() })
  }),
  http.get(endpoint('/ventas/resumen'), ({ request }) => {
    const { desde, hasta } = range(request)
    const rows: Schema['ResumenVentasFila'][] = []
    for (let date = desde; date <= hasta; date = shiftDate(date, 1)) rows.push({ periodo: date, ...summarize(date, date) })
    return HttpResponse.json(rows)
  }),
  http.post(endpoint('/ventas'), async ({ request }) => {
    const body = await request.json() as Schema['VentaSolicitud']
    if (!body.ticket?.trim() || !body.fechaHora || Number.isNaN(Date.parse(body.fechaHora)) || !Array.isArray(body.lineas) || !body.lineas.length) return error('Completa el ticket, la fecha y los productos.', 400)
    if (sales.some(s => s.ticket === body.ticket)) return error('Este ticket ya fue registrado. No se volvió a descontar stock.', 409)
    const planned = new Map<number, number>()
    const lines: Schema['VentaLinea'][] = []
    const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: configuration.zonaHoraria }).format(new Date(body.fechaHora))
    for (const [index, line] of body.lineas.entries()) {
      const p = product(line.productoId)
      if (!p) return error('No encontramos uno de los productos.', 404)
      if (!Number.isInteger(line.cantidad) || line.cantidad <= 0) return error('La cantidad debe ser un número entero mayor que cero.')
      const available = planned.get(p.id) ?? p.stockActual
      if (line.cantidad > available) return error(`Solo quedan ${available} unidades de ${p.nombre}.`)
      planned.set(p.id, available - line.cantidad)
      const unit = line.precioUnitario ?? p.precioVenta
      if (!Number.isFinite(unit) || unit <= p.costo) return error('El precio debe ser mayor que el costo.')
      const promo = promotions.find(promo => promo.productoId === p.id && promo.estado === 'ACTIVA' && promo.fechaInicio <= fecha && promo.fechaFin >= fecha)
      const discount = promo ? Math.round(unit * line.cantidad * promo.valor) / 100 : 0
      lines.push({ id: sales.length + index + 1, lineaTicket: index + 1, productoId: p.id, cantidad: line.cantidad, precioUnitario: unit, costoUnitario: p.costo, descuentoAplicado: discount, promocionId: promo?.id ?? null, total: Math.round((unit * line.cantidad - discount) * 100) / 100 })
    }
    planned.forEach((stock, id) => { product(id)!.stockActual = stock })
    lines.forEach(line => sales.push({ ...line, ticket: body.ticket, fecha }))
    const subtotal = lines.reduce((sum, l) => sum + l.cantidad * l.precioUnitario, 0)
    const descuentoTotal = lines.reduce((sum, l) => sum + l.descuentoAplicado, 0)
    const costoTotal = lines.reduce((sum, l) => sum + l.cantidad * l.costoUnitario, 0)
    return HttpResponse.json({ ticket: body.ticket, fechaHora: body.fechaHora, empleadoId: body.empleadoId ?? null, lineas: lines, subtotal, descuentoTotal, total: subtotal - descuentoTotal, costoTotal, margen: subtotal - descuentoTotal - costoTotal }, { status: 201 })
  }),
  http.get(endpoint('/promociones'), ({ request }) => {
    const filter = new URL(request.url).searchParams.get('estado')
    return HttpResponse.json(promotions.filter(p => !filter || p.estado === filter).map(p => ({ ...p, ventasReales: sales.filter(s => s.promocionId === p.id).reduce((sum, s) => sum + s.cantidad, 0) })))
  }),
  http.patch(endpoint('/promociones/:id/estado'), async ({ params, request }) => {
    const p = promotions.find(p => p.id === Number(params.id))
    if (!p) return error('No encontramos esta promoción.', 404)
    const body = await request.json() as Schema['PromocionEstadoSolicitud']
    try { p.estado = changePromotion(p, body.estado); return HttpResponse.json(p) }
    catch (e) { return error((e as Error).message, (e as Error).cause === 409 ? 409 : 422) }
  }),
  http.post(endpoint('/promociones/generar'), async ({ request }) => {
    const body = await request.json() as Schema['PromocionGenerarSolicitud']
    if (!['AUTO', 'BASE', 'IA'].includes(body.modelo)) return error('Selecciona un modelo válido.', 400)
    if (body.modelo === 'IA' && !configuration.proveedorIA) return error('Activa la inteligencia artificial en Ajustes para usar este modelo.')
    await delay(650)
    return HttpResponse.json(promotions.filter(p => p.estado === 'SUGERIDA' && (!body.productoIds?.length || body.productoIds.includes(p.productoId))), { status: 201 })
  }),
  http.get(endpoint('/promociones/:id/resultado'), ({ params }) => {
    const p = promotions.find(p => p.id === Number(params.id))
    if (!p) return error('No encontramos esta promoción.', 404)
    const rows = sales.filter(s => s.promocionId === p.id)
    const ingresosReales = rows.reduce((sum, s) => sum + s.cantidad * s.precioUnitario - s.descuentoAplicado, 0)
    const costoReal = rows.reduce((sum, s) => sum + s.cantidad * s.costoUnitario, 0)
    return HttpResponse.json({ promocionId: p.id, ventasEsperadas: p.ventasEsperadas, ventasReales: rows.reduce((sum, s) => sum + s.cantidad, 0), ingresosReales, costoReal, margenReal: ingresosReales - costoReal, gananciaEsperada: p.gananciaEsperada, roi: null })
  }),
  http.get(endpoint('/predicciones'), ({ request }) => {
    const params = new URL(request.url).searchParams
    const latest = new Map<string, Schema['Prediccion']>()
    predictions.forEach(p => latest.set(`${p.productoId}-${p.fechaObjetivo}-${p.modelo}`, p))
    return HttpResponse.json([...latest.values()].filter(p => (!params.get('productoId') || p.productoId === Number(params.get('productoId'))) && (!params.get('desde') || p.fechaObjetivo >= params.get('desde')!) && (!params.get('hasta') || p.fechaObjetivo <= params.get('hasta')!)))
  }),
  http.post(endpoint('/predicciones/generar'), async ({ request }) => {
    const body = await request.json() as Schema['PrediccionGenerarSolicitud']
    if (!Number.isInteger(body.dias) || body.dias < 1 || body.dias > 31 || !['AUTO', 'BASE', 'IA', 'AMBOS'].includes(body.modelo)) return error('Elige entre 1 y 31 días y un modelo válido.')
    if (['IA', 'AMBOS'].includes(body.modelo) && !configuration.proveedorIA) return error('Activa la inteligencia artificial en Ajustes para comparar ambos modelos.')
    if (body.productoIds?.some(id => !product(id))) return error('No encontramos uno de los productos.', 404)
    await delay(700)
    return HttpResponse.json(generatePredictions(body.productoIds || [], body.dias, body.modelo === 'AUTO' ? configuration.proveedorIA ? 'IA' : 'BASE' : body.modelo), { status: 201 })
  }),
  http.get(endpoint('/predicciones/comparar'), ({ request }) => {
    const id = Number(new URL(request.url).searchParams.get('productoId'))
    const { desde, hasta } = range(request)
    const result: Schema['PrediccionComparacion'][] = []
    for (let date = desde; date <= hasta; date = shiftDate(date, 1)) {
      const base = predictions.findLast(p => p.productoId === id && p.fechaObjetivo === date && p.modelo === 'BASE')
      const ia = predictions.findLast(p => p.productoId === id && p.fechaObjetivo === date && p.modelo === 'IA')
      result.push({ fecha: date, productoId: id, base: base ? { cantidadPredicha: base.cantidadPredicha, generadaEn: base.generadaEn } : null, ia: ia ? { cantidadPredicha: ia.cantidadPredicha, generadaEn: ia.generadaEn } : null, ventasReales: date >= today() ? null : sales.filter(s => s.productoId === id && s.fecha === date).reduce((sum, s) => sum + s.cantidad, 0) })
    }
    return HttpResponse.json(result)
  }),
]
}
export const handlers = createHandlers()

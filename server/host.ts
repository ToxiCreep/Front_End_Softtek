import { randomUUID } from 'node:crypto'
import type { MayaAction, MayaTool } from '../vendor/maya-portable/src/core/types.js'
import type { Schema } from '../src/api.js'
import { exactMoney, iaProviders, shiftDate, today } from '../src/api.js'
import { appRoutes, type ActionReview } from '../src/softy-contract.js'
import { adaptRequest, adaptResponse } from '../src/adapters.js'
import type { ResumenAgrupado } from '../src/backend-types.js'

export class HostError extends Error {
  constructor(message: string, public status = 400, public uncertain = false) { super(message) }
}
export type Host = ReturnType<typeof createHost>
/** adapt=true traduce entre el contrato de las páginas y Spring Boot (ver src/adapters.ts). */
export function createHost(base: string, headers: Record<string, string> = {}, adapt = false) {
    async function request<T>(path: string, method = 'GET', body?: unknown, operationId?: string): Promise<{ body: T; status: number }> {
      let response: Response
      if (adapt && body !== undefined) body = adaptRequest(path, method, body)
      try {
        response = await fetch(`${base}${path}`, { method, headers: { ...headers, 'Content-Type': 'application/json',
          ...(operationId ? { 'Idempotency-Key': operationId } : {}) },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000) })
      } catch { throw new HostError('No pudimos conectar con los datos de la sucursal. Revisa el resultado antes de repetir una operación.', 502, method !== 'GET') }
      if (response.ok && response.status === 204) return { body: null as T, status: 204 }
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new HostError(typeof result?.mensaje === 'string' ? result.mensaje : 'La API de la sucursal rechazó la solicitud.', response.status, response.status >= 500 && method !== 'GET')
      if (result === null) throw new HostError('La API no devolvió JSON válido.', 502, method !== 'GET')
      return { body: (adapt ? adaptResponse(path, method, result) : result) as T, status: response.status }
  }
  return { request, async call<T>(path: string, method = 'GET', body?: unknown, operationId?: string): Promise<T> { return (await request<T>(path, method, body, operationId)).body } }
}
function text(value: unknown, label: string, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new HostError(`${label} debe contener entre 1 y ${max} caracteres.`)
  return value.trim()
}
function integer(value: unknown, label: string) {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1) throw new HostError(`${label} debe ser un entero mayor que cero.`)
  return n
}
function dates(args: Record<string, unknown>, future = false) {
  const desde = args.desde ?? (future ? shiftDate(today(), 1) : shiftDate(today(), -6))
  const hasta = args.hasta ?? (future ? shiftDate(today(), 7) : today())
  for (const date of [desde, hasta]) if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new HostError('Usa fechas válidas con formato AAAA-MM-DD.')
  const days = (Date.parse(hasta as string) - Date.parse(desde as string)) / 86400000
  if (days < 0 || days > 30) throw new HostError('El periodo debe contener entre 1 y 31 días.')
  return new URLSearchParams({ desde: desde as string, hasta: hasta as string }).toString()
}
function allowed(args: Record<string, unknown>, keys: string[]) {
  if (Object.keys(args).some(key => !keys.includes(key))) throw new HostError('La solicitud contiene argumentos no reconocidos.')
}
export function hostTools(host: Host): MayaTool[] {
  return [
    { name: 'get_branch', description: 'Configuración y límites actuales de la sucursal.', inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: args => { allowed(args, []); return host.call('/configuracion') } },
    { name: 'list_products', description: 'Productos con id, nombre, precio, costo y stock. Consulta antes de proponer un formulario o identificar un producto.',
      inputSchema: { type: 'object', properties: { q: { type: 'string' }, categoria: { type: 'string' } }, additionalProperties: false },
      execute: args => { allowed(args, ['q', 'categoria']); const query = new URLSearchParams(); for (const key of ['q', 'categoria']) if (args[key] !== undefined) query.set(key, text(args[key], 'Filtro', 120)); return host.call(`/productos?${query}`) } },
    { name: 'get_inventory', description: 'Solo productos para reponer: bajo stock o agotados, con sus existencias y pedidos sugeridos de la API. Para excedentes o inventario completo usa list_products.', inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async args => {
        allowed(args, [])
        const [estado, reabasto] = await Promise.all([host.call<Schema['InventarioEstado'][]>('/inventario/estado'), host.call<Schema['Reabasto'][]>('/inventario/reabasto')])
        const productos = estado.map(producto => {
          const pedido = reabasto.find(item => item.productoId === producto.productoId)
          return { productoId: producto.productoId, nombre: producto.nombre, stockActual: producto.stockActual,
            stockMinimo: producto.stockMinimo, stockMaximo: producto.stockMaximo, estado: producto.semaforo,
            cantidadSugeridaAPedir: pedido?.cantidadAPedir ?? null, stockObjetivo: pedido?.stockRecomendado ?? null }
        })
        return productos.filter(item => item.estado === 'BAJO_STOCK' || item.estado === 'AGOTADO')
      } },
    { name: 'get_sales', description: 'Ventas, ganancia bruta, tickets, pérdidas y serie diaria en pesos mexicanos. Periodo de hasta 31 días.',
      inputSchema: { type: 'object', properties: { desde: { type: 'string' }, hasta: { type: 'string' } }, additionalProperties: false },
      execute: async args => { allowed(args, ['desde', 'hasta']); const query = dates(args); const [resumen, dias] = await Promise.all([host.call(`/dashboard/resumen?${query}`), host.call(`/ventas/resumen?${query}&agrupar=dia`)]); return { resumen, dias } } },
    { name: 'get_sales_breakdown', description: 'Rankings reales de ventas por producto o categoría. Devuelve hasta 10 grupos ordenados por ingresos, margen (ganancia bruta) o unidades. También compara días de la semana y horas. No extrapoles los grupos omitidos.',
      inputSchema: { type: 'object', properties: { agrupar: { type: 'string', enum: ['producto', 'categoria', 'diaSemana', 'hora'] }, ordenar: { type: 'string', enum: ['ingresos', 'margen', 'unidades'] }, limite: { type: 'integer', minimum: 1, maximum: 10 }, desde: { type: 'string' }, hasta: { type: 'string' } }, additionalProperties: false },
      execute: async args => {
        allowed(args, ['agrupar', 'ordenar', 'limite', 'desde', 'hasta'])
        const agrupar = args.agrupar ?? 'producto', ordenar = args.ordenar ?? 'ingresos', limite = args.limite ?? 5
        if (typeof agrupar !== 'string' || typeof ordenar !== 'string' || !['producto', 'categoria', 'diaSemana', 'hora'].includes(agrupar) || !['ingresos', 'margen', 'unidades'].includes(ordenar)) throw new HostError('Selecciona una agrupación y una métrica de ventas válidas.')
        if (typeof limite !== 'number' || !Number.isInteger(limite) || limite < 1 || limite > 10) throw new HostError('El ranking debe contener entre 1 y 10 grupos.')
        const query = dates(args)
        const rows = await host.call<ResumenAgrupado[]>(`/ventas/resumen?${query}&agrupar=${agrupar}`)
        return { periodo: Object.fromEntries(new URLSearchParams(query)), agrupar, ordenar, totalGrupos: rows.length, filas: [...rows].sort((a, b) => b[ordenar as 'ingresos' | 'margen' | 'unidades'] - a[ordenar as 'ingresos' | 'margen' | 'unidades']).slice(0, limite) }
      } },
    { name: 'get_losses', description: 'Pérdidas reales por día, categoría y producto en pesos mexicanos, valuadas a costo. Solo muestra las series que devuelve la API; si falta porDia no inventes una tendencia.',
      inputSchema: { type: 'object', properties: { desde: { type: 'string' }, hasta: { type: 'string' } }, additionalProperties: false },
      execute: args => { allowed(args, ['desde', 'hasta']); return host.call(`/inventario/perdidas?${dates(args)}`) } },
    { name: 'get_promotions', description: 'Promociones con id, productoId, estado, explicación y vigencia. Consulta antes de proponer activarlas o descartarlas.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execute: args => { allowed(args, []); return host.call('/promociones') } },
    { name: 'get_demand', description: 'Estimaciones diarias de un producto. Consulta; no son ventas realizadas.',
      inputSchema: { type: 'object', properties: { productoId: { type: 'integer' }, desde: { type: 'string' }, hasta: { type: 'string' } }, required: ['productoId'], additionalProperties: false },
      execute: async args => { allowed(args, ['productoId', 'desde', 'hasta']); const id = integer(args.productoId, 'Producto'); const producto = await host.call(`/productos/${id}`); return { producto, comparacion: await host.call(`/predicciones/comparar?productoId=${id}&${dates(args, true)}`) } } },
    { name: 'get_product_sales', description: 'Unidades vendidas de un producto por día, obtenidas del campo ventasReales de la API. Por defecto los últimos 7 días completos. null significa dato no disponible, nunca cero.',
      inputSchema: { type: 'object', properties: { productoId: { type: 'integer' }, desde: { type: 'string' }, hasta: { type: 'string' } }, required: ['productoId'], additionalProperties: false },
      execute: async args => {
        allowed(args, ['productoId', 'desde', 'hasta']); const id = integer(args.productoId, 'Producto')
        const query = dates({ desde: shiftDate(today(), -7), hasta: shiftDate(today(), -1), ...args })
        const producto = await host.call(`/productos/${id}`)
        const rows = await host.call<Schema['PrediccionComparacion'][]>(`/predicciones/comparar?productoId=${id}&${query}`)
        return { producto, dias: rows.map(row => ({ fecha: row.fecha, unidadesVendidas: row.ventasReales })) }
      } },
  ]
}
export interface PreparedOperation { review: ActionReview; path: string; method: string; body: unknown }
export async function prepareOperation(action: MayaAction, host: Host): Promise<PreparedOperation> {
  const p = action.payload ?? {}
  const operationId = randomUUID()
  let path: string, method: string, body: unknown, title: string, description: string, payload: Record<string, unknown>
  switch (action.type) {
    case 'ADD_STOCK': case 'REGISTER_SALE': {
      allowed(p, ['productoId', 'cantidad', 'motivo'])
      const productoId = integer(p.productoId, 'Producto'), cantidad = integer(p.cantidad, 'Cantidad')
      const product = await host.call<Schema['Producto']>(`/productos/${productoId}`)
      payload = { productoId, cantidad }
      if (action.type === 'ADD_STOCK') {
        const motivo = text(p.motivo, 'Motivo')
        payload.motivo = motivo
        path = '/inventario/movimientos'; method = 'POST'; body = { productoId, cantidad, motivo, tipo: 'ENTRADA' }
        title = '¿Agregar estas existencias?'; description = `${cantidad} unidades de ${product.nombre}. Motivo: ${motivo}.`
      } else {
        if (cantidad > product.stockActual) throw new HostError(`Solo quedan ${product.stockActual} unidades de ${product.nombre}.`, 422)
        path = '/ventas'; method = 'POST'; body = { ticket: `S-${operationId}`, fechaHora: new Date().toISOString(), empleadoId: null, lineas: [{ productoId, cantidad }] }
        title = '¿Registrar esta venta?'; description = `${cantidad} unidades de ${product.nombre}. Importe antes de promociones: ${exactMoney(cantidad * product.precioVenta)}. Las promociones vigentes se aplican al guardar.`
      }
      break
    }
    case 'ACTIVATE_PROMOTION': case 'DISMISS_PROMOTION': {
      allowed(p, ['promocionId']); const promocionId = integer(p.promocionId, 'Promoción')
      const promotion = (await host.call<Schema['Promocion'][]>('/promociones')).find(item => item.id === promocionId)
      if (!promotion) throw new HostError('No encontramos esta promoción.', 404)
      if (promotion.estado !== 'SUGERIDA') throw new HostError('Esta promoción ya fue revisada. Actualiza la consulta.', 409)
      const product = await host.call<Schema['Producto']>(`/productos/${promotion.productoId}`)
      payload = { promocionId }; path = `/promociones/${promocionId}/estado`; method = 'PATCH'
      body = { estado: action.type === 'ACTIVATE_PROMOTION' ? 'ACTIVA' : 'RECHAZADA' }
      title = action.type === 'ACTIVATE_PROMOTION' ? '¿Activar esta promoción?' : '¿Descartar esta sugerencia?'
      description = `${product.nombre}. ${promotion.explicacion} Vigencia: ${promotion.fechaInicio} al ${promotion.fechaFin}.`
      break
    }
    case 'SET_IA': {
      allowed(p, ['proveedorIA']); const provider = iaProviders.find(item => item.value === p.proveedorIA)
      if (!provider) throw new HostError('Selecciona un proveedor válido: 0, 1, 2 o 3.')
      payload = { proveedorIA: provider.value }; body = payload; path = '/configuracion/ia'; method = 'PATCH'
      title = provider.value === 0 ? '¿Desactivar la asistencia inteligente?' : `¿Usar ${provider.label} para la asistencia?`
      description = provider.value === 0 ? 'Las próximas recomendaciones usarán cálculos básicos.' : `El proveedor seleccionado para las próximas recomendaciones será ${provider.label}. Tú seguirás decidiendo qué promociones activar.`
      break
    }
    default: throw new HostError('Esta acción no está disponible. Usa las opciones de la app.')
  }
  return { review: { operationId, title, description, action: { type: action.type, payload, componentId: action.componentId } }, path, method, body }
}
export function pageAction(action: MayaAction) {
  allowed(action.payload ?? {}, ['path'])
  if (!appRoutes.includes(action.payload?.path as typeof appRoutes[number])) throw new HostError('Esta página no está disponible.')
  return { path: action.payload!.path }
}

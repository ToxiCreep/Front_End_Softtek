/**
 * Traduce entre el contrato que usan las páginas (contracts/openapi.json) y la API real
 * de Spring Boot. Se usa solo cuando VITE_USE_MOCKS=false: en el navegador desde api()
 * y en el servidor de Softy desde createHost(). Los mocks ya hablan el contrato de las páginas.
 *
 * Endpoints nuevos (empleados, plantillas, contexto, etc.) usan directamente la forma
 * del backend (src/backend-types.ts) y pasan sin cambios.
 */

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json => !!value && typeof value === 'object' && !Array.isArray(value)
const num = (value: unknown) => (typeof value === 'number' ? value : value == null ? 0 : Number(value))

// Proveedor de IA: el contrato de las páginas usa números (0-3) y el backend un enum.
const proveedorPorNumero: Record<number, string> = { 0: 'NINGUNO', 1: 'GEMINI', 2: 'ANTHROPIC', 3: 'OPENAI' }
const numeroPorProveedor: Record<string, number> = { NINGUNO: 0, GEMINI: 1, ANTHROPIC: 2, OPENAI: 3 }
export const proveedorANumero = (proveedor: unknown) => numeroPorProveedor[String(proveedor)] ?? 0
export const numeroAProveedor = (numero: unknown) => proveedorPorNumero[Number(numero)] ?? 'NINGUNO'

// Semáforo: el backend tiene 5 niveles; las páginas usan 4.
const semaforo: Record<string, string> = { AGOTADO: 'AGOTADO', CRITICO: 'BAJO_STOCK', BAJO: 'BAJO_STOCK', OK: 'NORMAL', SOBRESTOCK: 'SOBRESTOCK' }

/** Fecha y hora local de la sucursal sin zona (LocalDateTime de Java). */
export function localDateTime(date = new Date(), timeZone = 'America/Monterrey') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

function split(path: string) {
  const [pathname, search = ''] = path.split('?')
  return { pathname: pathname.replace(/\/$/, ''), params: new URLSearchParams(search) }
}

/** Ajusta el cuerpo que mandan las páginas a lo que acepta el backend. */
export function adaptRequest(path: string, method: string, body: unknown): unknown {
  const { pathname } = split(path)
  if (!isObject(body)) return body
  if (pathname === '/configuracion/ia' && method === 'PATCH' && 'proveedorIA' in body) {
    return { proveedorIa: numeroAProveedor(body.proveedorIA), ...(body.modeloIa ? { modeloIa: body.modeloIa } : {}) }
  }
  if (pathname === '/configuracion' && method === 'PUT') {
    const { proveedorIA: _p, proveedorIa: _pi, modeloIa: _m, iaActiva: _a, zonaHoraria: _z, ...rest } = body
    // Las páginas muestran el margen en porcentaje (15); el backend lo guarda como fracción (0.15).
    return { ...rest, margenMinimoPromo: num(rest.margenMinimoPromo) / 100 }
  }
  if (pathname === '/ventas' && method === 'POST') {
    const ticket = typeof body.ticket === 'string' ? body.ticket.slice(0, 30) : body.ticket
    const fecha = typeof body.fechaHora === 'string' && /Z$|[+-]\d\d:\d\d$/.test(body.fechaHora) ? localDateTime(new Date(body.fechaHora)) : body.fechaHora
    return { ...body, ticket, fechaHora: fecha }
  }
  if (pathname === '/promociones/generar' && method === 'POST') {
    const { productoIds: _ids, ...rest } = body
    return rest
  }
  return body
}

function configuracion(c: Json) {
  const margen = num(c.margenMinimoPromo)
  return {
    ...c,
    zonaHoraria: 'America/Monterrey',
    horaApertura: String(c.horaApertura ?? '').slice(0, 5),
    horaCierre: String(c.horaCierre ?? '').slice(0, 5),
    margenMinimoPromo: margen <= 1 ? Math.round(margen * 10000) / 100 : margen,
    descuentoMaximo: num(c.descuentoMaximo),
    proveedorIA: proveedorANumero(c.proveedorIa),
  }
}

function metricas(ventas: unknown, perdidas: unknown) {
  const v = isObject(ventas) ? ventas : {}
  return { ingresos: num(v.ingresos), costo: num(v.costo), margen: num(v.margen), tickets: num(v.tickets), unidades: num(v.unidades),
    ticketPromedio: num(v.ticketPromedio), perdidas: num(perdidas), ventasPorPromociones: num(v.ventasConPromocion) }
}

function dashboard(d: Json) {
  const anterior = isObject(d.periodoAnterior) ? d.periodoAnterior : {}
  const variacion = isObject(d.variacionPorcentaje) ? d.variacionPorcentaje : {}
  const pct = (key: string) => (typeof variacion[key] === 'number' ? variacion[key] : null)
  return {
    ...d,
    periodo: { desde: d.desde, hasta: d.hasta },
    periodoAnterior: { ...anterior, desde: anterior.desde, hasta: anterior.hasta },
    actual: metricas(d.ventas, d.perdidas),
    anterior: metricas(anterior.ventas, anterior.perdidas),
    variacionPorcentual: { ingresos: pct('ingresos'), costo: null, margen: pct('margen'), tickets: pct('tickets'), unidades: pct('unidades'),
      ticketPromedio: pct('ticketPromedio'), perdidas: pct('perdidas'), ventasPorPromociones: pct('ventasConPromocion') },
    generadoEn: new Date().toISOString(),
  }
}

/** Ajusta la respuesta del backend a lo que esperan las páginas. */
export function adaptResponse(path: string, method: string, data: unknown): unknown {
  const { pathname, params } = split(path)
  if ((pathname === '/configuracion' || pathname === '/configuracion/ia') && isObject(data)) return configuracion(data)
  if (pathname === '/dashboard/resumen' && method === 'GET' && isObject(data)) return dashboard(data)
  if (!Array.isArray(data) && pathname !== '/ventas' && !/^\/promociones\/\d+\/resultado$/.test(pathname)) return data

  switch (pathname) {
    case '/ventas/resumen':
      return (data as Json[]).map(r => ({ ...r, nombre: r.etiqueta, ingresos: num(r.ingresos), costo: num(r.costo), margen: num(r.margen) }))
    case '/inventario/estado':
      return (data as Json[]).map(e => ({ ...e, semaforoBackend: e.semaforo, semaforo: semaforo[String(e.semaforo)] ?? 'NORMAL' }))
    case '/inventario/alertas':
      return (data as Json[]).map(a => ({ ...a, estimada: a.estimada ?? false }))
    case '/inventario/reabasto':
      return (data as Json[]).map(r => ({ ...r, stockRecomendado: num(r.stockActual) + num(r.cantidadAPedir), fechaObjetivo: r.pedirAntesDe,
        generadaEn: null, modelo: String(r.fuente).includes('IA') ? 'IA' : 'BASE' }))
    case '/predicciones/comparar': {
      const productoId = Number(params.get('productoId'))
      const modelo = (value: unknown) => (typeof value === 'number' ? { cantidadPredicha: value, generadaEn: null } : null)
      return (data as Json[]).map(r => ({ ...r, productoId, base: modelo(r.base), ia: modelo(r.ia),
        ventasReales: typeof r.real === 'number' ? Math.round(r.real) : null }))
    }
    case '/ventas':
      return method === 'POST' && isObject(data) ? { ...data, descuentoTotal: num(data.descuento) } : data
  }
  if (/^\/promociones\/\d+\/resultado$/.test(pathname) && isObject(data)) {
    return { ...data, ingresosReales: num(data.ingresos), margenReal: num(data.margenReal), costoReal: num(data.ingresos) - num(data.margenReal) }
  }
  return data
}

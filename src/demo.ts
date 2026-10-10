import type { Schema } from './api'
import { shiftDate, today } from './api'

type Product = Schema['Producto']
type Promotion = Schema['Promocion']
export const configuration: Schema['Configuracion'] = {
  nombreSucursal: 'Sucursal Centro', zona: 'Monterrey, Nuevo León', zonaHoraria: 'America/Monterrey', tamano: 'MEDIANA',
  horaApertura: '08:00', horaCierre: '21:00', iaHabilitada: true, margenMinimoPromo: 15, descuentoMaximo: 30,
  mesesHistorico: 3, transaccionesPorEmpleadoHora: 20,
}
const product = (id: number, nombre: string, categoria: string, precioVenta: number, costo: number, stockActual: number, stockMinimo: number, stockMaximo: number, perecedero = false): Product => ({
  id, nombre, categoria, precioVenta, costo, stockActual, stockMinimo, stockMaximo, sku: `STK-${String(id).padStart(4, '0')}`,
  leadTimeDias: 2, esPerecedero: perecedero, vidaUtilDias: perecedero ? 14 : null, activo: true,
})
export const products: Product[] = [
  product(1, 'Leche entera · 1 litro', 'Lácteos', 32, 21, 8, 20, 100, true),
  product(2, 'Pan integral · 680 g', 'Panadería', 48, 29, 14, 15, 60, true),
  product(3, 'Yogur natural · 1 kg', 'Lácteos', 55, 30, 86, 15, 60, true),
  product(4, 'Agua natural · 1.5 litros', 'Bebidas', 18, 9, 64, 24, 160),
  product(5, 'Café molido · 250 g', 'Despensa', 89, 51, 28, 10, 60),
  product(6, 'Arroz · 1 kg', 'Despensa', 36, 22, 42, 15, 100),
  product(7, 'Huevos · 12 piezas', 'Lácteos', 52, 35, 0, 12, 60, true),
  product(8, 'Jugo de naranja · 1 litro', 'Bebidas', 34, 20, 40, 18, 80, true),
  product(9, 'Galletas de avena · 200 g', 'Despensa', 29, 15, 32, 12, 60),
  product(10, 'Detergente líquido · 1 litro', 'Limpieza', 68, 41, 24, 10, 50),
]
const promotion = (id: number, productoId: number, valor: number, motivo: Promotion['motivo'], explicacion: string): Promotion => ({
  id, productoId, tipo: 'PORCENTAJE', valor, fechaInicio: today(), fechaFin: shiftDate(today(), 3), estado: 'SUGERIDA', origen: 'ALGORITMO',
  motivo, ventasEsperadas: 25, ventasReales: 0, gananciaEsperada: 25 * (products.find(p => p.id === productoId)!.precioVenta * (1 - valor / 100) - products.find(p => p.id === productoId)!.costo), explicacion,
})
export const promotions: Promotion[] = [
  promotion(1, 3, 20, 'SOBRESTOCK', 'Tienes 86 unidades y tu límite recomendado es 60. Un descuento puede ayudarte a vender el excedente.'),
  promotion(2, 9, 15, 'BAJA_ROTACION', 'Las galletas se están vendiendo más despacio. Un descuento moderado puede impulsar su venta.'),
  promotion(3, 8, 10, 'TEMPORADA', 'Se espera más demanda de bebidas este fin de semana. Puedes aprovecharla con una promoción.'),
]
type SaleLine = { ticket: string; fecha: string; productoId: number; cantidad: number; precioUnitario: number; costoUnitario: number; descuentoAplicado: number; promocionId: number | null }
export const sales: SaleLine[] = []
for (let day = -13; day <= 0; day++) {
  for (let ticket = 0; ticket < 38 + (day + 13) * 3; ticket++) {
    for (let line = 0; line < 2; line++) {
      const p = products[(ticket + line * 3 + day + 20) % products.length]
      sales.push({ ticket: `H-${day}-${ticket}`, fecha: shiftDate(today(), day), productoId: p.id, cantidad: 1 + (ticket % 3), precioUnitario: p.precioVenta, costoUnitario: p.costo, descuentoAplicado: 0, promocionId: null })
    }
  }
}
export const movements: Schema['Movimiento'][] = [
  { id: 1, productoId: 2, fecha: `${today()}T09:00:00-06:00`, tipo: 'MERMA', cantidad: 3, costoTotal: 87, motivo: 'Empaque dañado', stockResultante: 14 },
  { id: 2, productoId: 3, fecha: `${shiftDate(today(), -1)}T09:00:00-06:00`, tipo: 'CADUCIDAD', cantidad: 2, costoTotal: 60, motivo: 'Retiro de producto', stockResultante: 86 },
]

export function inventoryState(): Schema['InventarioEstado'][] {
  return products.map(p => ({ productoId: p.id, sku: p.sku, nombre: p.nombre, categoria: p.categoria, stockActual: p.stockActual, stockMinimo: p.stockMinimo, stockMaximo: p.stockMaximo,
    puntoReorden: p.stockMinimo, diasCobertura: Math.round(p.stockActual / 8 * 10) / 10,
    semaforo: p.stockActual === 0 ? 'AGOTADO' : p.stockActual < p.stockMinimo ? 'BAJO_STOCK' : p.stockActual > p.stockMaximo ? 'SOBRESTOCK' : 'NORMAL' }))
}

export function alerts(): Schema['InventarioAlerta'][] {
  return inventoryState().filter(p => p.semaforo !== 'NORMAL').map(p => ({ productoId: p.productoId, sku: p.sku, nombre: p.nombre, stockActual: p.stockActual, tipo: p.semaforo as Schema['InventarioAlerta']['tipo'], puntoReorden: p.puntoReorden,
    diasRestantes: null, unidadesEnRiesgo: null, estimada: false,
    mensaje: p.semaforo === 'AGOTADO' ? 'Ya no quedan unidades. Agrega existencias para seguir vendiendo.' : p.semaforo === 'BAJO_STOCK' ? `Quedan ${p.stockActual} unidades. Revisa si necesitas pedir más.` : 'Hay más unidades de las recomendadas. Revisa una promoción.' }))
}

export function changeStock(p: Product, type: Schema['MovimientoSolicitud']['tipo'], amount: number) {
  if (!Number.isInteger(amount) || amount === 0 || (type !== 'AJUSTE' && amount < 0)) throw new Error('Escribe una cantidad válida de unidades.')
  const delta = type === 'MERMA' || type === 'CADUCIDAD' ? -amount : amount
  if (p.stockActual + delta < 0) throw new Error(`Solo hay ${p.stockActual} unidades disponibles.`)
  return p.stockActual + delta
}

export function changePromotion(p: Promotion, state: Promotion['estado']) {
  if (!(p.estado === 'SUGERIDA' && ['ACTIVA', 'RECHAZADA'].includes(state)) && !(p.estado === 'ACTIVA' && state === 'FINALIZADA')) throw new Error('Esta promoción ya cambió. Actualiza la pantalla.', { cause: 409 })
  if (state === 'ACTIVA') {
    const product = products.find(item => item.id === p.productoId)!
    if (p.valor > configuration.descuentoMaximo || product.precioVenta * (1 - p.valor / 100) < product.costo * (1 + configuration.margenMinimoPromo / 100)) throw new Error('El descuento no deja la ganancia mínima permitida.')
    if (promotions.some(item => item.id !== p.id && item.productoId === p.productoId && item.estado === 'ACTIVA' && item.fechaInicio <= p.fechaFin && item.fechaFin >= p.fechaInicio)) throw new Error('Este producto ya tiene una promoción activa para esas fechas.', { cause: 409 })
  }
  return state
}

export function summarize(desde: string, hasta: string): Schema['Metricas'] {
  const rows = sales.filter(s => s.fecha >= desde && s.fecha <= hasta)
  const ingresos = rows.reduce((sum, s) => sum + s.cantidad * s.precioUnitario - s.descuentoAplicado, 0)
  const costo = rows.reduce((sum, s) => sum + s.cantidad * s.costoUnitario, 0)
  const tickets = new Set(rows.map(s => s.ticket)).size
  return { ingresos, costo, margen: ingresos - costo, tickets, unidades: rows.reduce((sum, s) => sum + s.cantidad, 0), ticketPromedio: tickets ? ingresos / tickets : 0,
    perdidas: movements.filter(m => ['MERMA', 'CADUCIDAD'].includes(m.tipo) && m.fecha.slice(0, 10) >= desde && m.fecha.slice(0, 10) <= hasta).reduce((sum, m) => sum + m.costoTotal, 0),
    ventasPorPromociones: rows.filter(s => s.promocionId !== null).reduce((sum, s) => sum + s.cantidad * s.precioUnitario - s.descuentoAplicado, 0) }
}

export const predictions: Schema['Prediccion'][] = []
export function generatePredictions(ids: number[], days: number, model: 'BASE' | 'IA' | 'AMBOS') {
  const generated = new Date().toISOString()
  for (const p of products.filter(p => !ids.length || ids.includes(p.id))) {
    for (let day = 1; day <= days; day++) {
      for (const mode of (model === 'AMBOS' ? ['BASE', 'IA'] : [model]) as ('BASE' | 'IA')[]) {
        const count = 8 + p.id % 4 + (day % 3) + (mode === 'IA' ? 2 : 0)
        predictions.push({ id: predictions.length + 1, productoId: p.id, fechaObjetivo: shiftDate(today(), day), cantidadPredicha: count, limiteInferior: count - 2, limiteSuperior: count + 3,
          stockRecomendado: count * 7, cantidadAPedir: Math.max(0, count * 7 - p.stockActual), modelo: mode, generadaEn: generated })
      }
    }
  }
  return { generadaEn: generated, predicciones: predictions.filter(p => p.generadaEn === generated) }
}
generatePredictions([], 7, 'AMBOS')

import { describe, expect, it } from 'vitest'
import { adaptRequest, adaptResponse, localDateTime } from './adapters'

describe('adaptadores entre las páginas y Spring Boot', () => {
  it('convierte el proveedor de IA y el margen de la configuración', () => {
    expect(adaptRequest('/configuracion/ia', 'PATCH', { proveedorIA: 2 })).toEqual({ proveedorIa: 'ANTHROPIC' })
    expect(adaptRequest('/configuracion/ia', 'PATCH', { proveedorIA: 0, modeloIa: '' })).toEqual({ proveedorIa: 'NINGUNO' })
    const config = adaptResponse('/configuracion', 'GET', { nombreSucursal: 'Centro', tamano: 'MEDIANA', horaApertura: '08:00:00', horaCierre: '22:00:00',
      margenMinimoPromo: 0.15, descuentoMaximo: 40, mesesHistorico: 12, transaccionesPorEmpleadoHora: 20, proveedorIa: 'GEMINI', modeloIa: null, iaActiva: true }) as Record<string, unknown>
    expect(config).toMatchObject({ proveedorIA: 1, margenMinimoPromo: 15, horaApertura: '08:00', horaCierre: '22:00' })
    expect(adaptRequest('/configuracion', 'PUT', { ...config, margenMinimoPromo: 20 })).toMatchObject({ margenMinimoPromo: 0.2 })
    expect(adaptRequest('/configuracion', 'PUT', config)).not.toHaveProperty('proveedorIA')
  })

  it('arma el resumen del dashboard con actual, anterior y variación', () => {
    const r = adaptResponse('/dashboard/resumen?desde=2026-10-01&hasta=2026-10-07', 'GET', {
      desde: '2026-10-01', hasta: '2026-10-07', ventas: { ingresos: 1000, costo: 600, margen: 400, unidades: 50, tickets: 20, ticketPromedio: 50, ventasConPromocion: 100 },
      periodoAnterior: { desde: '2026-09-24', hasta: '2026-09-30', ventas: { ingresos: 800 }, perdidas: 10 }, perdidas: 25,
      variacionPorcentaje: { ingresos: 25, margen: null, tickets: 5 } }) as Record<string, any>
    expect(r.actual).toMatchObject({ ingresos: 1000, margen: 400, tickets: 20, perdidas: 25, ventasPorPromociones: 100 })
    expect(r.anterior.ingresos).toBe(800)
    expect(r.variacionPorcentual).toMatchObject({ ingresos: 25, margen: null, tickets: 5 })
  })

  it('traduce semáforo, reabasto y comparación de predicciones', () => {
    expect((adaptResponse('/inventario/estado', 'GET', [{ productoId: 1, semaforo: 'CRITICO' }, { productoId: 2, semaforo: 'OK' }]) as any[]).map(e => e.semaforo)).toEqual(['BAJO_STOCK', 'NORMAL'])
    expect((adaptResponse('/inventario/reabasto', 'GET', [{ productoId: 1, stockActual: 4, cantidadAPedir: 10, pedirAntesDe: '2026-10-12', fuente: 'PREDICCION_IA' }]) as any[])[0])
      .toMatchObject({ stockRecomendado: 14, fechaObjetivo: '2026-10-12', modelo: 'IA' })
    const comp = adaptResponse('/predicciones/comparar?productoId=3&desde=2026-10-11', 'GET', [{ fecha: '2026-10-11', real: null, base: 4.5, ia: null }]) as any[]
    expect(comp[0]).toMatchObject({ productoId: 3, base: { cantidadPredicha: 4.5 }, ia: null, ventasReales: null })
  })

  it('ajusta la venta: ticket de máximo 30 caracteres y hora local sin zona', () => {
    const body = adaptRequest('/ventas', 'POST', { ticket: `T-${'a'.repeat(36)}`, fechaHora: '2026-10-10T18:30:00.000Z', lineas: [] }) as Record<string, string>
    expect(body.ticket).toHaveLength(30)
    expect(body.fechaHora).toBe('2026-10-10T12:30:00')
    expect(localDateTime(new Date('2026-01-01T06:00:00Z'))).toBe('2026-01-01T00:00:00')
  })

  it('deja pasar los endpoints nuevos sin cambios', () => {
    const empleados = [{ id: 1, nombre: 'Ana', rol: 'CAJERO' }]
    expect(adaptResponse('/empleados', 'GET', empleados)).toBe(empleados)
    const pagina = { contenido: [], pagina: 0 }
    expect(adaptResponse('/ventas?page=0', 'GET', pagina)).toBe(pagina)
  })
})

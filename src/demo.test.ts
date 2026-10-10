import { describe, expect, it } from 'vitest'
import { changeStock, changePromotion, products, promotions, summarize, sales } from './demo'
import { shiftDate, today } from './api'

describe('reglas de la API simulada', () => {
  it('rechaza retirar más existencias de las disponibles sin cambiar el producto', () => {
    const p = { ...products[0] }
    expect(() => changeStock(p, 'MERMA', p.stockActual + 1)).toThrow()
    expect(p.stockActual).toBe(products[0].stockActual)
    expect(changeStock(p, 'ENTRADA', 5)).toBe(p.stockActual + 5)
    expect(() => changeStock(p, 'ENTRADA', -1)).toThrow()
  })
  it('rechaza transiciones inválidas y promociones sin margen', () => {
    expect(() => changePromotion({ ...promotions[0], estado: 'RECHAZADA' }, 'ACTIVA')).toThrow()
    expect(() => changePromotion({ ...promotions[0], valor: 90 }, 'ACTIVA')).toThrow()
    expect(changePromotion(promotions[0], 'ACTIVA')).toBe('ACTIVA')
  })
  it('deriva los totales de las mismas ventas y conserva consistencia de margen', () => {
    const totals = summarize(shiftDate(today(), -13), today())
    expect(totals.tickets).toBe(new Set(sales.map(s => s.ticket)).size)
    expect(totals.margen).toBe(totals.ingresos - totals.costo)
    expect(summarize('2000-01-01', '2000-01-02').ticketPromedio).toBe(0)
  })
})

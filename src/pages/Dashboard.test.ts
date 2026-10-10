import { describe, expect, it } from 'vitest'
import { pendingSummary } from './Dashboard'

describe('Resumen de pendientes en lenguaje natural', () => {
  it.each<[number, number, string]>([
    [3, 3, '3 productos necesitan existencias y tienes 3 promociones por revisar. Te acompañamos paso a paso.'],
    [1, 1, '1 producto necesita existencias y tienes 1 promoción por revisar. Te acompañamos paso a paso.'],
    [0, 0, 'No hay productos que necesites reponer y no tienes promociones pendientes. Te acompañamos paso a paso.'],
    [0, 2, 'No hay productos que necesites reponer y tienes 2 promociones por revisar. Te acompañamos paso a paso.'],
  ])('describe %i productos y %i promociones sin perder contexto', (products, promotions, expected) => {
    expect(pendingSummary(products, promotions)).toBe(expected)
  })
})

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { configuration, products, promotions, sales } from './demo'

vi.hoisted(() => vi.stubEnv('VITE_API_BASE_URL', 'http://localhost/api/v1'))
const { handlers } = await import('./mocks')
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => { server.close(); vi.unstubAllEnvs() })

const post = (ticket: string, lineas: unknown[]) => fetch('http://localhost/api/v1/ventas', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ticket, fechaHora: new Date().toISOString(), lineas }),
})

const changeIA = (body: unknown) => fetch('http://localhost/api/v1/configuracion/ia', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
it('guarda las cuatro opciones numéricas y ninguna deshabilita las predicciones IA', async () => {
  const initial = configuration.proveedorIA
  try {
    for (const proveedorIA of [1, 2, 3, 0]) {
      const response = await changeIA({ proveedorIA })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ proveedorIA })
      const saved = await (await fetch('http://localhost/api/v1/configuracion')).json()
      expect(saved.proveedorIA).toBe(proveedorIA)
      expect(saved).not.toHaveProperty('iaHabilitada')
    }
    const prediction = await fetch('http://localhost/api/v1/predicciones/generar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modelo: 'IA', dias: 7, productoIds: [1] }) })
    expect(prediction.status).toBe(422)
  } finally { configuration.proveedorIA = initial }
})
it('rechaza booleanos, valores fuera del enum y el contrato anterior sin cambiar la configuración', async () => {
  const initial = configuration.proveedorIA
  for (const body of [{ proveedorIA: true }, { proveedorIA: false }, { proveedorIA: '2' }, { proveedorIA: -1 }, { proveedorIA: 4 }, { proveedorIA: 1.5 }, { proveedorIA: null }, { iaHabilitada: true }, {}, null]) {
    expect((await changeIA(body)).status).toBe(400)
    expect(configuration.proveedorIA).toBe(initial)
  }
})

describe('API simulada de ventas', () => {
  it('rechaza todo el ticket si una línea supera las existencias', async () => {
    const stock = products[0].stockActual
    const count = sales.length
    const response = await post('TEST-INVALID', [{ productoId: 1, cantidad: 1 }, { productoId: 7, cantidad: 1 }])
    expect(response.status).toBe(422)
    expect(products[0].stockActual).toBe(stock)
    expect(sales).toHaveLength(count)
  })

  it('aplica descuento, conserva el margen y evita descontar dos veces un ticket', async () => {
    const p = products[2]
    const stock = p.stockActual
    const count = sales.length
    const oldState = promotions[0].estado
    promotions[0].estado = 'ACTIVA'
    try {
      const response = await post('TEST-VALID', [{ productoId: p.id, cantidad: 2 }])
      const sale = await response.json()
      expect(response.status).toBe(201)
      expect(sale.total).toBe(88)
      expect(sale.margen).toBe(28)
      expect(p.stockActual).toBe(stock - 2)
      expect((await post('TEST-VALID', [{ productoId: p.id, cantidad: 2 }])).status).toBe(409)
      expect(p.stockActual).toBe(stock - 2)
    } finally {
      p.stockActual = stock
      promotions[0].estado = oldState
      sales.splice(count)
    }
  })
})

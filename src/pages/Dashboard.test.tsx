// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import Dashboard, { pendingSummary } from './Dashboard'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

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

it('compara productos únicos pendientes con todo el inventario, no con el número de alertas', async () => {
  const data: Record<string, unknown> = {
    '/inventario/alertas': [{ productoId: 1, tipo: 'AGOTADO' }, { productoId: 1, tipo: 'BAJO_STOCK' }, { productoId: 2, tipo: 'BAJO_STOCK' }],
    '/inventario/estado': [{ productoId: 1 }, { productoId: 2 }, { productoId: 3 }, { productoId: 4 }],
    '/promociones': [], '/ventas/resumen': [], '/configuracion': { proveedorIA: 0 },
    '/dashboard/resumen': { actual: { ingresos: 0, margen: 0, tickets: 0, perdidas: 0 }, variacionPorcentual: { ingresos: null, margen: null, tickets: null } },
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = new URL(url, 'http://localhost').pathname.replace('/api/v1', '')
    return new Response(JSON.stringify(data[path]), { status: 200 })
  }))
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Dashboard /></MemoryRouter></QueryClientProvider>)
  expect((await screen.findByLabelText('2 productos necesitan reposición de 4 en total')).textContent).toBe('2 / 4')
})

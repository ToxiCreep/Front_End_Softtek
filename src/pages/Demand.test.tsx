// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import Demand from './Demand'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('usa las unidades a pedir en el pedido sugerido, no el stock total recomendado', async () => {
  const data: Record<string, unknown> = {
    '/productos': [{ id: 1, nombre: 'Leche', stockActual: 25 }],
    '/configuracion': { proveedorIA: 0 },
    '/predicciones/comparar': [{ fecha: '2026-10-11', base: { cantidadPredicha: 10 }, ia: null }],
    '/inventario/reabasto': [{ productoId: 1, stockRecomendado: 30, cantidadAPedir: 5, fechaObjetivo: '2026-10-11' }],
    '/predicciones': [], '/predicciones/precision': { modelos: [] },
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(data[new URL(url, 'http://localhost').pathname.replace('/api/v1', '')]))))
  const { container } = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Demand /></MemoryRouter></QueryClientProvider>)
  await screen.findByRole('heading', { name: 'Existencias y demanda' })
  const chart = within(container.querySelector('.demand-chart') as HTMLElement)
  const pedido = within(chart.getByText('Pedido sugerido').closest('li')!)
  expect(await pedido.findByText('5 unidades')).toBeTruthy()
  expect(pedido.queryByText('30 unidades')).toBeNull()
  expect(screen.getByText('Pedido sugerido', { selector: 'dt' }).nextElementSibling?.textContent).toBe('5 unidades')
})

it('identifica un pronóstico parcial sin completar los días desconocidos con cero', async () => {
  const data: Record<string, unknown> = {
    '/productos': [{ id: 1, nombre: 'Leche', stockActual: 5 }],
    '/configuracion': { proveedorIA: 0 },
    '/predicciones/comparar': [{ fecha: '2026-10-11', base: { cantidadPredicha: 10 }, ia: null }, { fecha: '2026-10-12', base: null, ia: null }],
    '/inventario/reabasto': [], '/predicciones': [], '/predicciones/precision': { modelos: [] },
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(data[new URL(url, 'http://localhost').pathname.replace('/api/v1', '')]))))
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Demand /></MemoryRouter></QueryClientProvider>)
  expect(await screen.findByRole('heading', { name: 'Existencias y demanda' })).toBeTruthy()
  expect(screen.getAllByText('Venta estimada · 1 de 7 días')).toHaveLength(2)
  expect(screen.getByText('10 unidades')).toBeTruthy()
  expect(screen.getByText('Sin dato')).toBeTruthy()
})

it('muestra solo estimaciones básicas en la gráfica diaria y el detalle aunque la API incluya IA', async () => {
  const basica = { id: 1, modelo: 'BASE', fechaObjetivo: '2026-10-11', cantidadPredicha: 23.5, limiteInferior: 18, limiteSuperior: 29, stockRecomendado: 30, cantidadAPedir: 5 }
  const data: Record<string, unknown> = {
    '/productos': [{ id: 1, nombre: 'Leche', stockActual: 5 }],
    '/configuracion': { proveedorIA: 1 },
    '/predicciones/comparar': [{ fecha: '2026-10-11', base: { cantidadPredicha: 10 }, ia: { cantidadPredicha: 100 } }],
    '/inventario/reabasto': [],
    '/predicciones': [basica, { ...basica, id: 2, modelo: 'IA', cantidadPredicha: 99.5 }],
    '/predicciones/precision': { modelos: [] },
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(data[new URL(url, 'http://localhost').pathname.replace('/api/v1', '')]))))
  const { container } = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Demand /></MemoryRouter></QueryClientProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Por día' }))
  const chart = within(container.querySelector('.demand-chart') as HTMLElement)
  expect(chart.getByRole('columnheader', { name: 'Cálculo básico', hidden: true })).toBeTruthy()
  expect(chart.queryByRole('columnheader', { name: 'Con inteligencia artificial', hidden: true })).toBeNull()
  expect(chart.getAllByRole('columnheader', { hidden: true })).toHaveLength(2)
  expect(chart.getByRole('cell', { name: '10', hidden: true })).toBeTruthy()
  expect(chart.queryByRole('cell', { name: '100', hidden: true })).toBeNull()
  const heading = await screen.findByRole('heading', { name: 'Detalle de la estimación' })
  const detalle = within(heading.closest('section')!)
  expect(detalle.getAllByRole('row')).toHaveLength(2)
  expect(detalle.getAllByRole('columnheader')).toHaveLength(5)
  expect(detalle.queryByRole('columnheader', { name: 'Cálculo' })).toBeNull()
  expect(detalle.getByRole('cell', { name: '23.5' })).toBeTruthy()
  expect(detalle.queryByRole('cell', { name: '99.5' })).toBeNull()
})

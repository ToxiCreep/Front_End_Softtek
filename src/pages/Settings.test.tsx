// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configuration } from '../demo'
import Settings from './Settings'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('cancela sin guardar y confirma una selección usando el nuevo cuerpo numérico', async () => {
  let current = { ...configuration, proveedorIA: 1 as typeof configuration.proveedorIA }
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/configuracion/ia/proveedores')) return new Response(JSON.stringify(['GEMINI', 'ANTHROPIC', 'OPENAI']), { status: 200 })
    if (url.endsWith('/sucursal-activa')) return new Response(JSON.stringify({ activa: 'MEDIANA', disponibles: ['PEQUENA', 'MEDIANA', 'GRANDE'] }), { status: 200 })
    if (url.endsWith('/configuracion/ia/estado')) return new Response(JSON.stringify({ proveedorConfigurado: 'GEMINI', disponible: true, registrados: [], conLlave: ['GEMINI'], llamadas: 0, fallos: 0 }), { status: 200 })
    if (options?.method === 'PATCH') current = { ...current, ...JSON.parse(String(options.body)) }
    return new Response(JSON.stringify(current), { status: 200 })
  })
  vi.stubGlobal('fetch', fetch)
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Settings /></QueryClientProvider>)
  const select = await screen.findByRole('combobox', { name: 'Proveedor de asistencia' })
  expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(['Gemini', 'Claude', 'GPT', 'Ninguna'])
  await userEvent.selectOptions(select, '2')
  await screen.findByRole('dialog', { name: '¿Usar Claude para la asistencia?' })
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(0)
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect((select as HTMLSelectElement).value).toBe('1')
  await userEvent.selectOptions(select, '3')
  await userEvent.click(await screen.findByRole('button', { name: 'Confirmar cambio' }))
  await screen.findByText('Proveedor seleccionado: GPT.')
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1)
  expect(JSON.parse(String(fetch.mock.calls.find(([, options]) => options?.method === 'PATCH')![1]!.body))).toEqual({ proveedorIA: 3 })
  await waitFor(() => expect((select as HTMLSelectElement).value).toBe('3'))
  expect(screen.queryByRole('dialog')).toBeNull()
})

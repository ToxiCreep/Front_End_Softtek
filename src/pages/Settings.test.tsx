// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configuration } from '../demo'
import Settings from './Settings'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('cancela sin guardar y confirma una selección usando el nuevo cuerpo numérico', async () => {
  let current = { ...configuration, proveedorIA: 1 as typeof configuration.proveedorIA }
  const fetch = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'PATCH') current = { ...current, ...JSON.parse(String(options.body)) }
    return new Response(JSON.stringify(current), { status: 200 })
  })
  vi.stubGlobal('fetch', fetch)
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Settings /></QueryClientProvider>)
  const select = await screen.findByRole('combobox', { name: 'Proveedor de asistencia' })
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Gemini', 'Claude', 'GPT', 'Ninguna'])
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

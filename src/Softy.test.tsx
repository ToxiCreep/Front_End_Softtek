// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Link, MemoryRouter } from 'react-router'
import Softy, { BusinessForm, SoftyProvider } from './Softy'
import { A2UIRenderer } from '../vendor/maya-portable/src/react/A2UIRenderer.js'
import { MayaHttpError, type MayaClient } from '../vendor/maya-portable/src/browser/client.js'
import type { A2UIScreen, MayaRequest } from '../vendor/maya-portable/src/core/types.js'
import { FakeRecognition } from '../vendor/maya-portable/tests/fakeRecognition.js'

const generated: A2UIScreen = { type: 'a2ui_screen', screenId: 'stock', assistantMessage: 'Hay 8 unidades.', components: [{ id: 'metric', type: 'StatTile', props: { label: 'Leche entera', value: '8 unidades' } }] }
beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function mount(client: MayaClient) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/inventario']}><SoftyProvider modelClient={client}><Softy /></SoftyProvider></MemoryRouter></QueryClientProvider>)
}
it('texto y dictado usan una misma petición, con contexto, historial y pantalla previa', async () => {
  const process = vi.fn(async (_request: MayaRequest) => generated)
  mount({ process })
  await userEvent.type(screen.getByLabelText('Tu solicitud'), 'Consulta existencias')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await within(screen.getByRole('region', { name: 'Interfaz creada por Softy' })).findByText('Hay 8 unidades.')
  expect(process.mock.calls[0][0]).toMatchObject({ message: 'Consulta existencias', context: { page: '/inventario' } })
  await userEvent.click(screen.getByRole('button', { name: 'Dictar' }))
  act(() => { FakeRecognition.current.result('Ahora muestra ventas', false) })
  expect(process).toHaveBeenCalledTimes(1)
  act(() => { FakeRecognition.current.result('Ahora muestra ventas', true); FakeRecognition.current.onend?.(); FakeRecognition.current.onend?.() })
  await waitFor(() => expect(process).toHaveBeenCalledTimes(2))
  expect(process.mock.calls[1][0]).toMatchObject({ message: 'Ahora muestra ventas', screen: generated, history: [{ role: 'user', content: 'Consulta existencias' }, { role: 'assistant', content: 'Hay 8 unidades.' }] })
})
it('cancelar un dictado no envía nada; permiso denegado conserva el texto y la entrada escrita funciona', async () => {
  const process = vi.fn(async () => generated)
  mount({ process })
  await userEvent.type(screen.getByLabelText('Tu solicitud'), 'Mi borrador')
  await userEvent.click(screen.getByRole('button', { name: 'Dictar' }))
  act(() => FakeRecognition.current.result('No enviar', true))
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar dictado' }))
  expect((screen.getByLabelText('Tu solicitud') as HTMLTextAreaElement).value).toBe('Mi borrador')
  expect(process).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Dictar' }))
  act(() => { FakeRecognition.current.onerror?.({ error: 'not-allowed' }); FakeRecognition.current.onend?.() })
  expect((await screen.findByRole('alert')).textContent).toContain('Permite el acceso')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() => expect(process).toHaveBeenCalledOnce())
})
it('el texto funciona sin reconocimiento de voz y un fallo del proveedor no reintenta escrituras', async () => {
  vi.stubGlobal('webkitSpeechRecognition', undefined)
  const process = vi.fn(async () => { throw new MayaHttpError('Proveedor caído', 502, true) })
  mount({ process })
  expect((screen.getByRole('button', { name: 'Dictar' }) as HTMLButtonElement).disabled).toBe(true)
  await userEvent.type(screen.getByLabelText('Tu solicitud'), 'Consultar')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  expect((await screen.findByRole('alert')).textContent).toContain('no la volveremos a enviar automáticamente')
  expect(process).toHaveBeenCalledOnce()
  expect((screen.getByLabelText('Tu solicitud') as HTMLTextAreaElement).value).toBe('Consultar')
})
it('restaura la conversación al volver a montar la página', async () => {
  const process = vi.fn(async (_request: MayaRequest) => generated)
  const page = mount({ process })
  await userEvent.click(screen.getByRole('button', { name: '¿Qué productos necesito reponer?' }))
  await within(screen.getByRole('region', { name: 'Interfaz creada por Softy' })).findByText('Hay 8 unidades.')
  page.unmount(); mount({ process })
  expect(within(screen.getByRole('region', { name: 'Interfaz creada por Softy' })).getByText('Hay 8 unidades.')).toBeTruthy()
  await userEvent.type(screen.getByLabelText('Tu solicitud'), 'Continúa')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() => expect(process).toHaveBeenCalledTimes(2))
  expect(process.mock.calls[1][0].history).toHaveLength(2)
  expect(process.mock.calls[1][0].screen).toMatchObject({ screenId: 'stock' })
})
it('conserva la última página de negocio tras navegar y recargar sin enviar otra consulta', async () => {
  const process = vi.fn(async (_request: MayaRequest) => generated)
  const show = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/softy']}><SoftyProvider modelClient={{ process }}>
    <Link to="/demanda?productoId=1">Ver demanda</Link><Link to="/softy">Volver a Softy</Link><Softy />
  </SoftyProvider></MemoryRouter></QueryClientProvider>)
  const page = show()
  await userEvent.click(screen.getByRole('button', { name: '¿Qué productos necesito reponer?' }))
  await within(screen.getByRole('region', { name: 'Interfaz creada por Softy' })).findByText('Hay 8 unidades.')
  await userEvent.click(screen.getByRole('link', { name: 'Ver demanda' }))
  await userEvent.click(screen.getByRole('link', { name: 'Volver a Softy' }))
  page.unmount(); show()
  await userEvent.type(screen.getByLabelText('Tu solicitud'), 'Continúa')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() => expect(process).toHaveBeenCalledTimes(2))
  expect(process.mock.calls[1][0]).toMatchObject({ context: { page: '/demanda?productoId=1' }, screen: generated })
  expect(process.mock.calls[1][0].history).toHaveLength(2)
})
it('una escritura generada se prepara y se revisa antes de enviarla al motor', async () => {
  const action = { type: 'ACTIVATE_PROMOTION', payload: { promocionId: 1 }, componentId: 'activate' }
  const initial: A2UIScreen = { ...generated, components: [{ id: 'activate', type: 'ActionButton', props: { label: 'Activar promoción', actionType: action.type, payload: action.payload } }] }
  const process = vi.fn(async (_request: MayaRequest) => initial)
  const fetch = vi.fn(async () => new Response(JSON.stringify({ operationId: 'operation-1', title: '¿Activar esta promoción?', description: 'Promoción de yogur consultada en la API.', action }), { status: 200 }))
  vi.stubGlobal('fetch', fetch); mount({ process })
  await userEvent.click(screen.getByRole('button', { name: '¿Qué productos necesito reponer?' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Activar promoción' }))
  await screen.findByRole('dialog')
  expect(process).toHaveBeenCalledOnce()
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))
  await waitFor(() => expect(process).toHaveBeenCalledTimes(2))
  expect(process.mock.calls[1][0]).toMatchObject({ action, context: { operationId: 'operation-1' }, screen: initial })
})
it('selectores y sliders transmiten el valor actualizado y conservan el payload del anfitrión', async () => {
  const onAction = vi.fn()
  render(<A2UIRenderer screen={{ ...generated, components: [
    { id: 'select', type: 'SelectInput', props: { label: 'Producto', name: 'producto', actionType: 'SELECT_PRODUCT', payload: { source: 'inventory' }, options: [{ label: 'Leche', value: '1' }, { label: 'Pan', value: '2' }] } },
    { id: 'range', type: 'SliderInput', props: { label: 'Días', name: 'dias', actionType: 'USER_PROMPT', payload: { text: 'Consulta ventas' }, min: 1, max: 7, defaultValue: 1 } },
  ] }} onAction={onAction} />)
  await userEvent.selectOptions(screen.getByLabelText('Producto'), '2')
  await userEvent.click(screen.getAllByRole('button', { name: 'Actualizar' })[0])
  expect(onAction.mock.calls[0][0]).toMatchObject({ type: 'SELECT_PRODUCT', payload: { source: 'inventory', name: 'producto', value: '2' } })
  fireEvent.change(screen.getByLabelText('Días'), { target: { value: '4' } })
  await userEvent.click(screen.getAllByRole('button', { name: 'Actualizar' })[1])
  expect(onAction.mock.calls[1][0].payload).toMatchObject({ text: 'Consulta ventas', name: 'dias' })
  expect(onAction.mock.calls[1][0].payload.value).toBe(4)
})
it('el formulario propio consulta productos reales y emite cantidad y motivo actualizados', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ id: 1, nombre: 'Leche entera', stockActual: 8 }]), { status: 200 })))
  const onAction = vi.fn()
  render(<QueryClientProvider client={new QueryClient()}><BusinessForm component={{ id: 'form', type: 'StockForm', props: { productoId: 1 } }} onAction={onAction} loading={false} /></QueryClientProvider>)
  await screen.findByText('Tienes 8 unidades.')
  await userEvent.type(screen.getByLabelText('¿Cuántas unidades recibiste?'), '5')
  await userEvent.click(screen.getByRole('button', { name: 'Revisar antes de guardar' }))
  expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'ADD_STOCK', componentId: 'form', payload: { productoId: 1, cantidad: 5, motivo: 'Recepción de proveedor' } })
})

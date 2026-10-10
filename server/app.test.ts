import { afterAll, expect, it, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

let server: Server | undefined
const spring = setupServer(http.get('http://spring.production.test/api/v1/configuracion', () =>
  HttpResponse.json({ nombreSucursal: 'Sucursal real', proveedorIa: 'NINGUNO' })))
afterAll(async () => {
  spring.close(); vi.unstubAllEnvs()
  if (server) await new Promise<void>(resolve => { server!.close(() => resolve()); server!.closeAllConnections() })
})

it('exports the Vercel handler without listening and serves JSON with production mocks disabled', async () => {
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('VITE_USE_MOCKS', 'true')
  vi.stubEnv('SOFTTEK_API_URL', 'http://spring.production.test/api/v1')
  vi.stubEnv('OLLAMA_API_KEY', ''); vi.stubEnv('OLLAMA_HOST', 'https://ollama.com')
  spring.listen({ onUnhandledRequest: 'bypass' })
  const { default: app } = await import('../api/softy')
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server!.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const health = await fetch(`${base}/api/softy/health`)
  expect(health.headers.get('content-type')).toContain('application/json')
  expect(await health.json()).toMatchObject({ service: 'Softy', providerConfigured: false })
  const data = await fetch(`${base}/api/v1/configuracion`)
  expect(await data.json()).toMatchObject({ nombreSucursal: 'Sucursal real' })
  const chat = await fetch(`${base}/api/softy/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Reponer' }) })
  expect(chat.status).toBe(503)
  expect(await chat.json()).toMatchObject({ error: expect.stringContaining('OLLAMA_API_KEY'), actionMayHaveRun: false })
  const invalid = await fetch(`${base}/api/softy/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' })
  expect(invalid.status).toBe(400)
  expect(await invalid.json()).toMatchObject({ error: expect.stringContaining('JSON') })
  const missing = await fetch(`${base}/api/softy/missing`)
  expect(missing.status).toBe(404)
  expect(await missing.json()).toMatchObject({ error: 'Ruta no disponible.' })
})

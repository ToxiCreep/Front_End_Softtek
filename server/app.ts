import express from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createOllamaProvider } from '../vendor/maya-portable/src/core/index.js'
import { createHost } from './host.js'
import { createSoftyRouter } from './softy.js'

const base = (process.env.SOFTTEK_API_URL || 'https://tienda-inteligente-api.onrender.com/api/v1').replace(/\/$/, '')
const ollamaHost = process.env.OLLAMA_HOST || 'https://ollama.com'
const cloud = new URL(ollamaHost).hostname === 'ollama.com'
const defaultModel = cloud ? 'gemma4:31b' : 'gemma3:4b'
const provider = cloud && !process.env.OLLAMA_API_KEY ? undefined : createOllamaProvider({ host: ollamaHost,
  apiKey: process.env.OLLAMA_API_KEY, model: process.env.A2UI_MODEL || defaultModel,
  planningModel: process.env.OLLAMA_MODEL || defaultModel, timeoutMs: 60_000 })
const forwarded = (req: express.Request) => ({ ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}), ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}) })
// Softy lee los datos con el contrato de las páginas; el proxy /api/v1 los pasa sin tocar (el navegador los adapta).
const hostFor = (req: express.Request) => createHost(base, forwarded(req), true)
const rawHostFor = (req: express.Request) => createHost(base, forwarded(req))
const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '256kb' }))
app.use('/api/softy', createSoftyRouter(provider, hostFor, process.env.OLLAMA_API_KEY))
app.use('/api/v1', async (req, res) => {
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) { res.status(405).json({ mensaje: 'Método no disponible.' }); return }
  try {
    const result = await rawHostFor(req).request(req.url, req.method, ['GET', 'DELETE'].includes(req.method) ? undefined : req.body)
    if (result.status === 204) res.status(204).end(); else res.status(result.status).json(result.body)
  }
  catch (error) { res.status(error && typeof error === 'object' && 'status' in error ? Number(error.status) : 502).json({ mensaje: error instanceof Error ? error.message : 'No pudimos conectar con la sucursal.' }) }
})
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Ruta no disponible.' }) })
if (existsSync(resolve('dist/index.html'))) { app.use(express.static(resolve('dist'))); app.get('*', (_req, res) => res.sendFile(resolve('dist/index.html'))) }
app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(error.status ?? 500).json({ error: 'El cuerpo JSON no es válido o excede el tamaño permitido.' }) })
export default app

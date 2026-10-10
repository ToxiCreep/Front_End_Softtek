import type { components } from './api-schema'
import { adaptRequest, adaptResponse } from './adapters'

export type Schema = components['schemas']
export const iaProviders = [{ value: 1, label: 'Gemini' }, { value: 2, label: 'Claude' }, { value: 3, label: 'GPT' }, { value: 0, label: 'Ninguna' }] as const
export const useMocks = import.meta.env?.VITE_USE_MOCKS !== 'false'
export const apiBase = (import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 60_000)
  const method = (options.method || 'GET').toUpperCase()
  // Con el backend real, el cuerpo se traduce al formato de Spring Boot (ver adapters.ts).
  const requestBody = !useMocks && typeof options.body === 'string'
    ? JSON.stringify(adaptRequest(path, method, JSON.parse(options.body))) : options.body
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      body: requestBody,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
    // 204 No Content (por ejemplo, DELETE) no trae cuerpo.
    const text = response.status === 204 ? '' : await response.text()
    const parsed: unknown = text ? JSON.parse(text) : null
    const body = response.ok && !useMocks ? adaptResponse(path, method, parsed) : parsed
    if (!response.ok) {
      const message = body && typeof body === 'object' && 'mensaje' in body && typeof body.mensaje === 'string'
        ? body.mensaje : 'No pudimos completar la acción. Intenta de nuevo.'
      throw new Error(message)
    }
    return body as T
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('El servidor respondió algo inesperado. Intenta de nuevo en un momento.')
    if (error instanceof TypeError) throw new Error('No pudimos conectar. Revisa tu conexión e intenta de nuevo.')
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('La respuesta está tardando demasiado. Revisa el resultado antes de intentar otra vez.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value)
export const exactMoney = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
export const quantity = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date())
export function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export const shortDate = (value: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))

import type { components } from './api-schema'

export type Schema = components['schemas']
export const useMocks = import.meta.env.VITE_USE_MOCKS === 'true' || (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS !== 'false')
export const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 60_000)
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
    const body: unknown = await response.json()
    if (!response.ok) {
      const message = body && typeof body === 'object' && 'mensaje' in body && typeof body.mensaje === 'string'
        ? body.mensaje : 'No pudimos completar la acción. Intenta de nuevo.'
      throw new Error(message)
    }
    return body as T
  } catch (error) {
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

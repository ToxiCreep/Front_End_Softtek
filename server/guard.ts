import type { A2UIComponent, A2UIScreen, HistoryItem } from '../vendor/maya-portable/src/core/types.js'

// Candados deterministas alrededor de Softy. Corren antes y después del modelo,
// así que no dependen de que el modelo obedezca el prompt.

export const MAX_MESSAGE_LENGTH = 500
const MAX_TEXT_LENGTH = 600

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Intentos de cambiar las reglas, sacar el prompt o cambiar el rol del asistente.
const injection = [
  /\b(ignora|olvida|omite|salta|desactiva)\w*\b.{0,40}\b(instruccion|regla|restriccion|indicacion|prompt|anterior)/,
  /\b(ignore|forget|disregard|bypass)\b.{0,40}\b(instruction|rule|prompt|previous|above)/,
  /\b(system prompt|prompt del sistema|instrucciones (internas|del sistema|ocultas)|tus reglas)\b/,
  /\b(ahora eres|a partir de ahora eres|actua como|finge (ser|que)|haz de cuenta|roleplay|juego de rol|pretend|you are now|act as)\b/,
  /\b(modo (desarrollador|dios|admin\w*|sin restricciones)|developer mode|jailbreak|\bdan\b)/,
  /\b(soy (el )?(admin\w*|desarrollador|programador|dueno de anthropic|de softtek)|orden del administrador)\b/,
  /<\s*\/?\s*(system|script|instructions?)\b/,
  /```/,
]
// Contenido que nunca forma parte de la operación de una tienda.
const offTopic = /\b(poema|cancion|letra de|chiste|cuento|historia de amor|ensayo|tarea escolar|mi tarea|resume(n|me) (el|la|un) (libro|novela|pelicula)|receta|horoscopo|traduce|traduccion|programa en|codigo (en|de)|script|javascript|python|java\b|sql|html|presidente|eleccion|partido politico|politica|religion|pelicula|serie de tv|videojuego|futbol|apuesta|criptomoneda|bitcoin|acciones de la bolsa)\b/
// Vocabulario del negocio: si aparece, el mensaje se deja pasar al clasificador del modelo.
const business = /\b(producto|existencia|inventario|stock|reponer|reabast|surtir|pedido|unidad|venta|vend|ticket|promocion|promo|descuento|oferta|demanda|prediccion|pronostico|sucursal|tienda|merma|caduc|almacen|bodega|ganancia|perdida|precio|costo|categoria|ajuste|configuracion|proveedor|softy)\w*/
const link = /\b(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|io|ai|mx|xyz|ru)\b/

export type GuardResult = { ok: true } | { ok: false; reason: 'empty' | 'too_long' | 'injection' | 'link' | 'off_topic' }

export function checkMessage(message: string): GuardResult {
  const text = normalize(message.trim())
  if (!text) return { ok: false, reason: 'empty' }
  if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, reason: 'too_long' }
  if (injection.some(pattern => pattern.test(text))) return { ok: false, reason: 'injection' }
  if (link.test(text)) return { ok: false, reason: 'link' }
  if (offTopic.test(text) && !business.test(text)) return { ok: false, reason: 'off_topic' }
  return { ok: true }
}

// El historial también llega al modelo: se descartan turnos que no pasarían el filtro.
export function cleanHistory(history: HistoryItem[] | undefined): HistoryItem[] | undefined {
  return history?.filter(item => item.role !== 'user' || checkMessage(item.content).ok)
}

// Revisa lo que generó el modelo: sin enlaces, código ni HTML, y con textos acotados.
function unsafeText(value: unknown) {
  if (typeof value !== 'string') return false
  const text = normalize(value)
  return link.test(text) || /```|<\s*[a-z!/]/.test(text) || value.length > MAX_TEXT_LENGTH
}
function cleanComponents(components: A2UIComponent[]): A2UIComponent[] {
  return components
    .filter(component => !Object.values(component.props ?? {}).some(unsafeText))
    .map(component => component.children ? { ...component, children: cleanComponents(component.children) } : component)
}
export function cleanScreen(screen: A2UIScreen, fallbackMessage: string): A2UIScreen {
  return {
    ...screen,
    assistantMessage: unsafeText(screen.assistantMessage) ? fallbackMessage : screen.assistantMessage,
    components: cleanComponents(screen.components),
    suggestedPrompts: screen.suggestedPrompts?.filter(prompt => checkMessage(prompt).ok && !unsafeText(prompt)),
  }
}

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { ArrowUp, Mic, Sparkles, Square, X } from 'lucide-react'
import { createMayaClient, MayaHttpError } from '../vendor/maya-portable/src/browser/index.js'
import { A2UIRenderer, useVoiceInput } from '../vendor/maya-portable/src/react/index.js'
import type { ComponentRendererProps } from '../vendor/maya-portable/src/react/A2UIRenderer.js'
import { normalizeA2UIScreen } from '../vendor/maya-portable/src/core/protocol.js'
import type { A2UIScreen, HistoryItem, MayaAction } from '../vendor/maya-portable/src/core/types.js'
import type { MayaClient } from '../vendor/maya-portable/src/browser/client.js'
import { api, useMocks, type Schema } from './api'
import { appRoutes, writeActions, type ActionReview } from './softy-contract'
import { Modal, Notice, PageTitle, useOnline } from './ui'
import '../vendor/maya-portable/src/react/styles.css'
import './softy.css'

const client = createMayaClient({ endpoint: '/api/softy/chat' })
const storageKey = 'softy.conversation.v1'
type Conversation = { history: HistoryItem[]; screen?: A2UIScreen; contextPage?: string }
function storedConversation(): Conversation {
  try {
    const data = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
    if (!data || !Array.isArray(data.history)) return { history: [] }
    const history = data.history.filter((item: HistoryItem) => ['user', 'assistant'].includes(item.role) && typeof item.content === 'string').slice(-24)
    return { history, ...(typeof data.contextPage === 'string' ? { contextPage: data.contextPage } : {}), ...(data.screen ? { screen: normalizeA2UIScreen(data.screen) } : {}) }
  } catch { return { history: [] } }
}
interface SoftyState extends Conversation {
  loading: boolean; error: string; contextPage: string
  send: (message: string, action?: MayaAction, operationId?: string) => Promise<boolean>
  reset: () => void
}
const SoftyContext = createContext<SoftyState | undefined>(undefined)
export function SoftyProvider({ children, modelClient = client }: { children: ReactNode; modelClient?: MayaClient }) {
  const [conversation, setConversation] = useState<Conversation>(storedConversation)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const queryClient = useQueryClient()
  const location = useLocation()
  const contextPage = useRef(conversation.contextPage || '/')
  if (location.pathname !== '/softy') contextPage.current = `${location.pathname}${location.search}`
  useEffect(() => { try { sessionStorage.setItem(storageKey, JSON.stringify({ ...conversation, contextPage: contextPage.current })) } catch { /* El chat funciona si el navegador bloquea el almacenamiento. */ } }, [conversation, location.pathname, location.search])
  async function send(message: string, action?: MayaAction, operationId?: string) {
    if (busy.current || (!message.trim() && !action)) return false
    busy.current = true; setLoading(true); setError('')
    const userMessage = message.trim() || `Acción confirmada: ${action!.type}`
    try {
      const screen = await modelClient.process({ message: userMessage, history: conversation.history.slice(-22), screen: conversation.screen,
        context: { page: contextPage.current, dataMode: useMocks ? 'simulated' : 'spring-boot', ...(operationId ? { operationId } : {}) }, action }, AbortSignal.timeout(300_000))
      setConversation({ screen, history: [...conversation.history, { role: 'user', content: userMessage } as HistoryItem, { role: 'assistant', content: screen.assistantMessage } as HistoryItem].slice(-24) })
      return true
    } catch (cause) {
      const uncertain = cause instanceof MayaHttpError ? cause.actionMayHaveRun : Boolean(operationId)
      setError(`${cause instanceof Error ? cause.message : 'No pudimos conectar con Softy.'}${uncertain ? ' La operación pudo haberse guardado. Revisa el resultado en la app antes de repetirla; no la volveremos a enviar automáticamente.' : ''}`)
      return false
    } finally {
      if (operationId) await queryClient.invalidateQueries()
      busy.current = false; setLoading(false)
    }
  }
  return <SoftyContext.Provider value={{ ...conversation, loading, error, contextPage: contextPage.current, send, reset: () => { if (!busy.current) { setConversation({ history: [] }); setError('') } } }}>{children}</SoftyContext.Provider>
}
export default function Softy() {
  const softy = useContext(SoftyContext)!
  const [message, setMessage] = useState('')
  const [review, setReview] = useState<ActionReview | null>(null)
  const [actionError, setActionError] = useState('')
  const [preparing, setPreparing] = useState(false)
  const preparingRef = useRef(false)
  const navigate = useNavigate()
  const online = useOnline()
  const disabled = softy.loading || preparing || !online
  const voice = useVoiceInput({ lang: 'es-MX', onFinal: text => { setMessage(text); void submit(text) } })
  async function submit(text = message) { if (await softy.send(text)) setMessage('') }
  async function onAction(action: MayaAction) {
    if (disabled || preparingRef.current) return
    setActionError('')
    if (action.type === 'USER_PROMPT') {
      const text = action.payload?.value ?? action.payload?.text
      const prompt = typeof text === 'number' && Number.isFinite(text) ? `${action.payload?.text || 'Valor seleccionado'}: ${text}` : text
      if (typeof prompt !== 'string' || !prompt.trim()) { setActionError('Escribe una consulta para continuar.'); return }
      await softy.send(prompt); return
    }
    if (action.type === 'OPEN_PAGE') {
      if (appRoutes.includes(action.payload?.path as typeof appRoutes[number])) navigate(action.payload!.path as string)
      else setActionError('Esta página no está disponible.')
      return
    }
    if (writeActions.includes(action.type as typeof writeActions[number])) {
      preparingRef.current = true; setPreparing(true)
      try {
        const response = await fetch('/api/softy/actions/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action), signal: AbortSignal.timeout(30_000) })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'No pudimos preparar la operación.')
        setReview(body as ActionReview)
      } catch (error) { setActionError(error instanceof Error ? error.message : 'No pudimos preparar la operación.') }
      finally { preparingRef.current = false; setPreparing(false) }
      return
    }
    if (['FILTER_PRODUCTS', 'SELECT_PRODUCT'].includes(action.type)) { await softy.send('Actualiza la consulta con el valor seleccionado.', action); return }
    setActionError('Esta acción no está disponible. Puedes pedirle a Softy otra opción.')
  }
  return <div className="softy-page">
    <PageTitle title="Softy" description="Dime qué necesitas revisar o hacer en tu sucursal."><button className="text-button" disabled={disabled || voice.listening} onClick={() => { voice.cancel(); softy.reset(); setMessage(''); setActionError('') }}>Nueva conversación</button></PageTitle>
    <div className="softy-layout">
      <section className="panel softy-chat" aria-label="Conversación con Softy">
        <div className="softy-chat-title"><Sparkles size={22} aria-hidden="true" /><h2>¿En qué te ayudo?</h2></div>
        <form onSubmit={event => { event.preventDefault(); void submit() }} className="stack-form">
          <label htmlFor="softy-message">Tu solicitud</label>
          <textarea id="softy-message" value={voice.listening ? voice.transcript : message} onChange={event => setMessage(event.target.value)} placeholder="Por ejemplo: ¿qué productos necesito reponer?" maxLength={6000} disabled={disabled || voice.listening} rows={3} />
          <div className="softy-composer-actions">{voice.listening ? <><button type="button" className="button outlined" onClick={voice.stop}><Square size={17} aria-hidden="true" />Terminar dictado</button><button type="button" className="icon-button" aria-label="Cancelar dictado" onClick={voice.cancel}><X size={20} aria-hidden="true" /></button></> : <button type="button" className="button outlined" disabled={!voice.supported || disabled} onClick={voice.start}><Mic size={18} aria-hidden="true" />Dictar</button>}<button className="button primary" disabled={disabled || voice.listening || !message.trim()}><ArrowUp size={18} aria-hidden="true" />{softy.loading ? 'Consultando…' : 'Enviar'}</button></div>
        </form>
        {voice.listening && <p className="field-help" role="status">Escuchando… Termina el dictado para enviar tu frase.</p>}
        {!voice.supported && <p className="field-help">El dictado no está disponible en este navegador. Puedes escribir.</p>}
        {voice.error && <Notice error message={voice.error} />}
        {softy.history.length > 0 && <details className="softy-history"><summary>Conversación ({Math.ceil(softy.history.length / 2)})</summary><div>{softy.history.map((item, i) => <div key={i} data-role={item.role}><strong>{item.role === 'user' ? 'Tú' : 'Softy'}</strong><p>{item.content}</p></div>)}</div></details>}
      </section>
      <section className="softy-results" aria-label="Interfaz creada por Softy" aria-busy={softy.loading || preparing}>
        {(softy.error || actionError) && <Notice error message={softy.error || actionError} />}
        {softy.loading && <p className="softy-working" role="status">Softy está consultando tu sucursal…</p>}
        {preparing && <p className="softy-working" role="status">Preparando los datos para que los revises…</p>}
        {softy.screen && useMocks && <p className="field-help">Datos de ejemplo de la sucursal.</p>}
        {softy.screen ? <><p className="softy-answer">{softy.screen.assistantMessage}</p><A2UIRenderer key={softy.screen.screenId} screen={softy.screen} loading={disabled || voice.listening} onAction={action => { void onAction(action) }} components={{ StockForm: BusinessForm, SaleForm: BusinessForm }} />{softy.screen.suggestedPrompts?.length ? <div className="softy-suggestions">{softy.screen.suggestedPrompts.map((prompt, i) => <button className="button outlined" disabled={disabled || voice.listening} key={i} onClick={() => { void softy.send(prompt) }}>{prompt}</button>)}</div> : null}</> : <div className="panel softy-start"><Sparkles size={32} aria-hidden="true" /><h2>Empieza con una pregunta</h2><div className="softy-suggestions">{['¿Qué productos necesito reponer?', 'Muéstrame las ventas de los últimos 7 días', 'Quiero agregar existencias'].map(prompt => <button key={prompt} className="button outlined" disabled={disabled || voice.listening} onClick={() => { void softy.send(prompt) }}>{prompt}</button>)}</div></div>}
      </section>
    </div>
    {review && <Modal title={review.title} description={review.description} onClose={() => setReview(null)} busy={softy.loading}>
      <div className="modal-actions"><button className="button outlined" disabled={softy.loading} onClick={() => setReview(null)}>Cancelar</button><button className="button primary" disabled={disabled} onClick={() => { const pending = review; setReview(null); void softy.send('Guarda la operación que acabo de revisar y muestra el resultado de la API.', pending.action, pending.operationId) }}>Confirmar y guardar</button></div>
    </Modal>}
  </div>
}
export function BusinessForm({ component, onAction, loading }: ComponentRendererProps) {
  const products = useQuery({ queryKey: ['productos', '', ''], queryFn: () => api<Schema['Producto'][]>('/productos') })
  const [productId, setProductId] = useState(String(component.props.productoId || ''))
  const [count, setCount] = useState('')
  const [reason, setReason] = useState('Recepción de proveedor')
  const sale = component.type === 'SaleForm'
  const product = products.data?.find(item => String(item.id) === productId)
  const invalidStock = sale && product && Number(count) > product.stockActual
  return <section className="maya-card"><h3>{sale ? 'Registrar venta' : 'Agregar existencias'}</h3><form className="stack-form" onSubmit={event => {
    event.preventDefault(); if (!product || invalidStock || !Number.isSafeInteger(Number(count)) || Number(count) < 1 || loading) return
    onAction({ type: sale ? 'REGISTER_SALE' : 'ADD_STOCK', componentId: component.id, payload: { productoId: product.id, cantidad: Number(count), ...(!sale ? { motivo: reason } : {}) } })
  }}><label>Producto<select required disabled={loading || products.isPending} value={productId} onChange={event => setProductId(event.target.value)}><option value="">Selecciona un producto</option>{products.data?.map(item => <option value={item.id} key={item.id}>{item.nombre}</option>)}</select></label>
    {product && <p className="field-help">Tienes {product.stockActual} unidades.</p>}
    <label>{sale ? '¿Cuántas unidades vendiste?' : '¿Cuántas unidades recibiste?'}<input required type="number" min="1" step="1" inputMode="numeric" value={count} disabled={loading} onChange={event => setCount(event.target.value)} /></label>
    {!sale && <label>Motivo<input required maxLength={200} value={reason} disabled={loading} onChange={event => setReason(event.target.value)} /></label>}
    {products.isError && <Notice error message="No pudimos cargar los productos. Vuelve a consultar." />}
    {invalidStock && <Notice error message="La cantidad supera las unidades disponibles." />}
    <button className="button primary" disabled={loading || !product || Boolean(invalidStock)}>Revisar antes de guardar</button>
  </form></section>
}

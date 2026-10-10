import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Sparkles, Tag } from 'lucide-react'
import { api, exactMoney, money, shortDate } from '../api'
import type { Schema } from '../api'
import { Empty, ErrorState, Loading, Modal, Notice, PageTitle, Status, useOnline } from '../ui'

type Promotion = Schema['Promocion']
function offer(p: Promotion) { return p.tipo === 'PORCENTAJE' ? `${p.valor}%` : p.tipo === 'DOS_X_UNO' ? '2 × 1' : money(p.valor) }

export default function Promotions() {
  const client = useQueryClient()
  const online = useOnline()
  const [filter, setFilter] = useState<Promotion['estado']>('SUGERIDA')
  const [selected, setSelected] = useState<{ promotion: Promotion; state: 'ACTIVA' | 'RECHAZADA' | 'FINALIZADA' } | null>(null)
  const [result, setResult] = useState<Promotion | null>(null)
  const [notice, setNotice] = useState('')
  const promos = useQuery({ queryKey: ['promociones'], queryFn: () => api<Promotion[]>('/promociones') })
  const products = useQuery({ queryKey: ['productos', '', ''], queryFn: () => api<Schema['Producto'][]>('/productos') })
  const generate = useMutation({ mutationFn: () => api<Promotion[]>('/promociones/generar', { method: 'POST', body: JSON.stringify({ productoIds: [], modelo: 'AUTO' }) }), onSuccess: data => { client.invalidateQueries({ queryKey: ['promociones'] }); setFilter('SUGERIDA'); setNotice(data.length ? `Encontramos ${data.length} sugerencias para que las revises.` : 'No hay nuevas sugerencias por ahora.') } })
  const change = useMutation({ mutationFn: () => api<Promotion>(`/promociones/${selected!.promotion.id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado: selected!.state }) }), onSuccess: p => {
    client.invalidateQueries()
    setNotice(p.estado === 'ACTIVA' ? 'Promoción activada. Se aplicará automáticamente a las ventas durante su vigencia.' : p.estado === 'RECHAZADA' ? 'Sugerencia descartada. El precio del producto sigue igual.' : 'Promoción finalizada. Ya no se aplicará a las nuevas ventas.')
    setSelected(null)
  } })
  const filtered = promos.data?.filter(p => p.estado === filter) || []
  return <>
    <PageTitle title="Promociones" description="Revisa las sugerencias. Tú decides cuáles activar."><button className="button primary" onClick={() => generate.mutate()} disabled={!online || generate.isPending}><Sparkles size={18} aria-hidden="true" />{generate.isPending ? 'Buscando sugerencias…' : 'Buscar sugerencias'}</button></PageTitle>
    {notice && <Notice message={notice} />}{generate.isError && <Notice error message={generate.error.message} />}
    {promos.data && <section className="summary-grid" aria-label="Resumen de promociones">{[
      { label: 'Total de promociones', value: promos.data.length, icon: Tag },
      { label: 'Por revisar', value: promos.data.filter(p => p.estado === 'SUGERIDA').length, icon: Sparkles },
      { label: 'Activas', value: promos.data.filter(p => p.estado === 'ACTIVA').length, icon: Check },
    ].map(item => <article className="metric-card summary-stat" key={item.label}><span className="summary-icon blue"><item.icon size={22} aria-hidden="true" /></span><div><span>{item.label}</span><strong>{item.value}</strong></div></article>)}</section>}
    <div className="promotion-tabs" aria-label="Estado de las promociones">{(['SUGERIDA', 'ACTIVA', 'FINALIZADA', 'RECHAZADA'] as const).map(state => <button key={state} aria-pressed={state === filter} onClick={() => setFilter(state)}>{state === 'SUGERIDA' ? 'Por revisar' : state === 'ACTIVA' ? 'Activas' : state === 'FINALIZADA' ? 'Finalizadas' : 'Descartadas'}<span>{promos.data?.filter(p => p.estado === state).length || 0}</span></button>)}</div>
    {promos.isPending || products.isPending ? <Loading /> : promos.isError || products.isError ? <ErrorState error={promos.error || products.error} retry={() => { promos.refetch(); products.refetch() }} /> : !filtered.length ? <div className="panel"><Empty title={filter === 'ACTIVA' ? 'Todavía no tienes promociones activas' : 'No hay promociones en esta lista'} description={filter === 'ACTIVA' ? 'Revisa las sugerencias y activa la que te convenga.' : 'Puedes revisar otro estado o buscar nuevas sugerencias.'} /></div> : <div className="promotion-grid">{filtered.map(p => {
      const product = products.data?.find(item => item.id === p.productoId)
      const discounted = product ? p.tipo === 'PORCENTAJE' ? product.precioVenta * (1 - p.valor / 100) : p.tipo === 'PRECIO_FIJO' ? p.valor : product.precioVenta / 2 : null
      return <article className="promotion-card" key={p.id}><div className="promotion-card-heading"><span className="offer-icon"><Tag size={20} aria-hidden="true" /></span><Status value={p.estado} /></div><div className="offer-value">{offer(p)}<span>{p.tipo === 'PORCENTAJE' ? 'de descuento' : p.tipo === 'DOS_X_UNO' ? 'por cada par' : 'precio por unidad'}</span></div><h2>{product?.nombre || `Producto ${p.productoId}`}</h2><p className="promotion-reason">{p.explicacion}</p>
        <dl className="promotion-facts"><div><dt>Precio con promoción</dt><dd>{discounted !== null ? exactMoney(discounted) : 'Por confirmar'}</dd></div><div><dt>Vigencia</dt><dd>{shortDate(p.fechaInicio)} – {shortDate(p.fechaFin)}</dd></div></dl>
        <div className="offer-estimate"><span>Ganancia bruta estimada</span><strong>{p.gananciaEsperada === null ? 'Sin estimación' : money(p.gananciaEsperada)}</strong></div>
        {p.estado === 'SUGERIDA' ? <div className="promotion-actions"><button className="button primary" disabled={!online} onClick={() => { change.reset(); setSelected({ promotion: p, state: 'ACTIVA' }) }}><Check size={17} aria-hidden="true" />Activar promoción</button><button className="text-button" onClick={() => { change.reset(); setSelected({ promotion: p, state: 'RECHAZADA' }) }} disabled={!online}>Descartar sugerencia</button></div> : <div className="promotion-actions"><button className="button outlined" onClick={() => setResult(p)}>Ver resultados</button>{p.estado === 'ACTIVA' && <button className="text-button" disabled={!online} onClick={() => { change.reset(); setSelected({ promotion: p, state: 'FINALIZADA' }) }}>Finalizar promoción</button>}</div>}
      </article>
    })}</div>}
    {selected && <Modal title={selected.state === 'ACTIVA' ? '¿Activar esta promoción?' : selected.state === 'RECHAZADA' ? '¿Descartar esta sugerencia?' : '¿Finalizar esta promoción?'} onClose={() => setSelected(null)} busy={change.isPending}><div className="confirm-product"><strong>{products.data?.find(p => p.id === selected.promotion.productoId)?.nombre}</strong><span>{offer(selected.promotion)} {selected.promotion.tipo === 'PORCENTAJE' ? 'de descuento' : ''}</span></div><p className="confirm-copy">{selected.state === 'ACTIVA' ? `Se aplicará a las ventas de este producto del ${shortDate(selected.promotion.fechaInicio)} al ${shortDate(selected.promotion.fechaFin)}.` : selected.state === 'RECHAZADA' ? 'El precio seguirá igual. Esta sugerencia quedará en la lista de descartadas.' : 'El descuento dejará de aplicarse a las nuevas ventas. Se conservarán los resultados registrados.'}</p>{change.isError && <Notice error message={change.error.message} />}<div className="modal-actions"><button className="button outlined" disabled={change.isPending} onClick={() => setSelected(null)}>Volver</button><button className="button primary" disabled={!online || change.isPending} onClick={() => change.mutate()}>{change.isPending ? 'Guardando…' : selected.state === 'ACTIVA' ? 'Sí, activar promoción' : selected.state === 'RECHAZADA' ? 'Sí, descartar' : 'Sí, finalizar'}</button></div></Modal>}
    {result && <Results promotion={result} onClose={() => setResult(null)} />}
  </>
}
function Results({ promotion, onClose }: { promotion: Promotion; onClose: () => void }) {
  const result = useQuery({ queryKey: ['resultado', promotion.id], queryFn: () => api<Schema['PromocionResultado']>(`/promociones/${promotion.id}/resultado`) })
  return <Modal title="Resultados de la promoción" description="Estos números vienen de las ventas registradas con esta promoción." onClose={onClose}>{result.isPending ? <Loading /> : result.isError ? <ErrorState error={result.error} retry={() => result.refetch()} /> : <><div className="result-grid"><div><span>Unidades vendidas</span><strong>{result.data.ventasReales}</strong></div><div><span>Ingresos por ventas</span><strong>{money(result.data.ingresosReales)}</strong></div><div><span>Ganancia bruta real</span><strong>{money(result.data.margenReal)}</strong></div></div>{result.data.ventasReales === 0 && <p className="form-note">Todavía no hay ventas registradas con esta promoción.</p>}</>}<div className="modal-actions"><button className="button primary" onClick={onClose}>Entendido</button></div></Modal>
}

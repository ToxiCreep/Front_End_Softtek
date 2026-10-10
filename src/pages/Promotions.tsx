import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Sparkles, Tag, X } from 'lucide-react'
import type { FormEvent } from 'react'
import type { PromocionSolicitud } from '../backend-types'
import { api, exactMoney, money, shiftDate, shortDate, today } from '../api'
import type { Schema } from '../api'
import { BarChart, Empty, ErrorState, Loading, Modal, Notice, PageTitle, Status, useOnline } from '../ui'

type Promotion = Schema['Promocion']
function offer(p: Promotion) { return p.tipo === 'PORCENTAJE' ? `${p.valor}%` : p.tipo === 'DOS_X_UNO' ? '2 × 1' : money(p.valor) }

export default function Promotions() {
  const client = useQueryClient()
  const online = useOnline()
  const [filter, setFilter] = useState<Promotion['estado']>('SUGERIDA')
  const [selected, setSelected] = useState<{ promotion: Promotion; state: 'ACTIVA' | 'RECHAZADA' | 'FINALIZADA' } | null>(null)
  const [result, setResult] = useState<Promotion | null>(null)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<Promotion | 'nueva' | null>(null)
  const [maxSugerencias, setMaxSugerencias] = useState(10)
  const [horizonte, setHorizonte] = useState(14)
  const promos = useQuery({ queryKey: ['promociones'], queryFn: () => api<Promotion[]>('/promociones') })
  const products = useQuery({ queryKey: ['productos', '', ''], queryFn: () => api<Schema['Producto'][]>('/productos') })
  const generate = useMutation({ mutationFn: () => api<Promotion[]>('/promociones/generar', { method: 'POST', body: JSON.stringify({ productoIds: [], modelo: 'AUTO', maxSugerencias, horizonteDias: horizonte }) }), onSuccess: data => { client.invalidateQueries({ queryKey: ['promociones'] }); setFilter('SUGERIDA'); setNotice(data.length ? `Encontramos ${data.length} sugerencias para que las revises.` : 'No hay nuevas sugerencias por ahora.') } })
  const change = useMutation({ mutationFn: () => api<Promotion>(`/promociones/${selected!.promotion.id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado: selected!.state }) }), onSuccess: p => {
    client.invalidateQueries()
    setNotice(p.estado === 'ACTIVA' ? 'Promoción activada. Se aplicará automáticamente a las ventas durante su vigencia.' : p.estado === 'RECHAZADA' ? 'Sugerencia descartada. El precio del producto sigue igual.' : 'Promoción finalizada. Ya no se aplicará a las nuevas ventas.')
    setSelected(null)
  } })
  const filtered = promos.data?.filter(p => p.estado === filter) || []
  return <>
    <PageTitle title="Promociones" description="Revisa las sugerencias. Tú decides cuáles activar."><div className="heading-actions"><button className="button outlined" disabled={!online} onClick={() => setForm('nueva')}><Plus size={18} aria-hidden="true" />Crear promoción</button><button className="button primary" onClick={() => generate.mutate()} disabled={!online || generate.isPending}><Sparkles size={18} aria-hidden="true" />{generate.isPending ? 'Buscando sugerencias…' : 'Buscar sugerencias'}</button></div></PageTitle>
    <div className="filter-row promotion-controls"><label>Máximo de sugerencias<select value={maxSugerencias} onChange={e => setMaxSugerencias(Number(e.target.value))}>{[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}</select></label><label>Días de vigencia a evaluar<select value={horizonte} onChange={e => setHorizonte(Number(e.target.value))}>{[7, 14, 30, 60].map(n => <option key={n} value={n}>{n} días</option>)}</select></label></div>
    {notice && <Notice message={notice} />}{generate.isError && <Notice error message={generate.error.message} />}
    {promos.data && <section className="summary-grid promotion-summary" aria-label="Estado de las promociones">{([
      { state: 'SUGERIDA', label: 'Por revisar', icon: Sparkles },
      { state: 'ACTIVA', label: 'Activas', icon: Check },
      { state: 'FINALIZADA', label: 'Finalizadas', icon: Tag },
      { state: 'RECHAZADA', label: 'Descartadas', icon: X },
    ] as const).map(item => <button type="button" className="metric-card summary-stat promotion-filter" key={item.state} aria-pressed={filter === item.state} onClick={() => setFilter(item.state)}><span className="summary-icon blue"><item.icon size={22} aria-hidden="true" /></span><div><span>{item.label}</span><strong>{promos.data.filter(p => p.estado === item.state).length}</strong></div></button>)}</section>}
    {promos.isPending || products.isPending ? <Loading /> : promos.isError || products.isError ? <ErrorState error={promos.error || products.error} retry={() => { promos.refetch(); products.refetch() }} /> : !filtered.length ? <div className="panel"><Empty title={filter === 'ACTIVA' ? 'Todavía no tienes promociones activas' : 'No hay promociones en esta lista'} description={filter === 'ACTIVA' ? 'Revisa las sugerencias y activa la que te convenga.' : 'Puedes revisar otro estado o buscar nuevas sugerencias.'} /></div> : <div className="promotion-grid">{filtered.map(p => {
      const product = products.data?.find(item => item.id === p.productoId)
      const discounted = product ? p.tipo === 'PORCENTAJE' ? product.precioVenta * (1 - p.valor / 100) : p.tipo === 'PRECIO_FIJO' ? p.valor : product.precioVenta / 2 : null
      return <article className="promotion-card" key={p.id}><div className="promotion-card-heading"><span className="offer-icon"><Tag size={20} aria-hidden="true" /></span><Status value={p.estado} /></div><div className="offer-value">{offer(p)}<span>{p.tipo === 'PORCENTAJE' ? 'de descuento' : p.tipo === 'DOS_X_UNO' ? 'por cada par' : 'precio por unidad'}</span></div><h2>{product?.nombre || `Producto ${p.productoId}`}</h2><p className="promotion-reason">{p.explicacion}</p>
        <dl className="promotion-facts"><div><dt>Precio con promoción</dt><dd>{discounted !== null ? exactMoney(discounted) : 'Por confirmar'}</dd></div><div><dt>Vigencia</dt><dd>{shortDate(p.fechaInicio)} – {shortDate(p.fechaFin)}</dd></div></dl>
        <div className="offer-estimate"><span>Ganancia bruta estimada</span><strong>{p.gananciaEsperada === null ? 'Sin estimación' : money(p.gananciaEsperada)}</strong></div>
        {p.estado === 'SUGERIDA' ? <div className="promotion-actions"><button className="button primary" disabled={!online} onClick={() => { change.reset(); setSelected({ promotion: p, state: 'ACTIVA' }) }}><Check size={17} aria-hidden="true" />Activar promoción</button><button className="text-button" disabled={!online} onClick={() => setForm(p)}><Pencil size={15} aria-hidden="true" /> Ajustar antes de activar</button><button className="text-button" onClick={() => { change.reset(); setSelected({ promotion: p, state: 'RECHAZADA' }) }} disabled={!online}>Descartar sugerencia</button></div> : <div className="promotion-actions"><button className="button outlined" onClick={() => setResult(p)}>Ver resultados</button>{p.estado === 'ACTIVA' && <button className="text-button" disabled={!online} onClick={() => { change.reset(); setSelected({ promotion: p, state: 'FINALIZADA' }) }}>Finalizar promoción</button>}</div>}
      </article>
    })}</div>}
    {selected && <Modal title={selected.state === 'ACTIVA' ? '¿Activar esta promoción?' : selected.state === 'RECHAZADA' ? '¿Descartar esta sugerencia?' : '¿Finalizar esta promoción?'} onClose={() => setSelected(null)} busy={change.isPending}><div className="confirm-product"><strong>{products.data?.find(p => p.id === selected.promotion.productoId)?.nombre}</strong><span>{offer(selected.promotion)} {selected.promotion.tipo === 'PORCENTAJE' ? 'de descuento' : ''}</span></div><p className="confirm-copy">{selected.state === 'ACTIVA' ? `Se aplicará a las ventas de este producto del ${shortDate(selected.promotion.fechaInicio)} al ${shortDate(selected.promotion.fechaFin)}.` : selected.state === 'RECHAZADA' ? 'El precio seguirá igual. Esta sugerencia quedará en la lista de descartadas.' : 'El descuento dejará de aplicarse a las nuevas ventas. Se conservarán los resultados registrados.'}</p>{change.isError && <Notice error message={change.error.message} />}<div className="modal-actions"><button className="button outlined" disabled={change.isPending} onClick={() => setSelected(null)}>Volver</button><button className="button primary" disabled={!online || change.isPending} onClick={() => change.mutate()}>{change.isPending ? 'Guardando…' : selected.state === 'ACTIVA' ? 'Sí, activar promoción' : selected.state === 'RECHAZADA' ? 'Sí, descartar' : 'Sí, finalizar'}</button></div></Modal>}
    {result && <Results promotion={result} onClose={() => setResult(null)} />}
    {form && <PromotionForm promotion={form === 'nueva' ? null : form} onClose={() => setForm(null)} onSaved={(message, estado) => { client.invalidateQueries(); setForm(null); setFilter(estado); setNotice(message) }} />}
  </>
}
function Results({ promotion, onClose }: { promotion: Promotion; onClose: () => void }) {
  const result = useQuery({ queryKey: ['resultado', promotion.id], queryFn: () => api<Schema['PromocionResultado']>(`/promociones/${promotion.id}/resultado`) })
  return <Modal title="Resultados de la promoción" description="Estos números vienen de las ventas registradas con esta promoción." onClose={onClose}>{result.isPending ? <Loading /> : result.isError ? <ErrorState error={result.error} retry={() => result.refetch()} /> : <><BarChart labels={['Ingresos', 'Ganancia bruta']} series={[{ label: 'Importe', color: 'var(--chart-blue)', values: [result.data.ingresosReales, result.data.margenReal] }]} currency description="Ingresos y ganancia bruta reales de esta promoción, en pesos mexicanos." /><div className="result-grid"><div><span>Unidades vendidas</span><strong>{result.data.ventasReales}</strong></div>{typeof extra(result.data).incrementoVentasPorcentaje === 'number' && <div><span>Incremento contra no tener promoción</span><strong>{Math.round(extra(result.data).incrementoVentasPorcentaje!)}%</strong></div>}{typeof extra(result.data).gananciaIncremental === 'number' && <div><span>Ganancia adicional</span><strong>{money(extra(result.data).gananciaIncremental!)}</strong></div>}<div><span>Ingresos por ventas</span><strong>{money(result.data.ingresosReales)}</strong></div><div><span>Ganancia bruta real</span><strong>{money(result.data.margenReal)}</strong></div></div>{result.data.ventasReales === 0 && <p className="form-note">Todavía no hay ventas registradas con esta promoción.</p>}</>}<div className="modal-actions"><button className="button primary" onClick={onClose}>Entendido</button></div></Modal>
}

const extra = (r: unknown) => r as { incrementoVentasPorcentaje?: number | null; gananciaIncremental?: number | null }

function PromotionForm({ promotion, onClose, onSaved }: { promotion: Promotion | null; onClose: () => void; onSaved: (message: string, estado: Promotion['estado']) => void }) {
  const online = useOnline()
  const products = useQuery({ queryKey: ['productos', '', ''], queryFn: () => api<Schema['Producto'][]>('/productos') })
  // Al editar, se vuelve a leer la promoción para no sobrescribir cambios recientes.
  const fresh = useQuery({ queryKey: ['promocion', promotion?.id], queryFn: () => api<Promotion>(`/promociones/${promotion!.id}`), enabled: !!promotion })
  const base = fresh.data ?? promotion
  const [f, setF] = useState<Partial<Record<'productoId' | 'tipo' | 'valor' | 'fechaInicio' | 'fechaFin' | 'explicacion', string>>>({})
  const v = { productoId: String(base?.productoId ?? ''), tipo: base?.tipo ?? 'PORCENTAJE', valor: String(base?.valor ?? 10), fechaInicio: base?.fechaInicio ?? today(), fechaFin: base?.fechaFin ?? shiftDate(today(), 7), explicacion: base?.explicacion ?? '', ...f }
  const [activar, setActivar] = useState(false)
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setF({ ...f, [key]: e.target.value })
  const invalid = v.fechaFin < v.fechaInicio
  const save = useMutation({ mutationFn: () => {
    const body: PromocionSolicitud = { productoId: Number(v.productoId), tipo: v.tipo as PromocionSolicitud['tipo'], valor: v.tipo === 'DOS_X_UNO' ? undefined : Number(v.valor), fechaInicio: v.fechaInicio, fechaFin: v.fechaFin,
      motivo: base?.motivo ?? undefined, explicacion: v.explicacion.trim() || undefined, ...(promotion ? {} : { activar }) }
    return api<Promotion>(promotion ? `/promociones/${promotion.id}` : '/promociones', { method: promotion ? 'PUT' : 'POST', body: JSON.stringify(body) })
  }, onSuccess: p => onSaved(promotion ? 'Promoción ajustada.' : p.estado === 'ACTIVA' ? 'Promoción creada y activada.' : 'Promoción creada. Queda por revisar.', p.estado) })
  function submit(event: FormEvent) { event.preventDefault(); if (online && !save.isPending && !invalid) save.mutate() }
  return <Modal title={promotion ? 'Ajustar promoción' : 'Crear promoción'} description="El sistema valida que respete el descuento máximo y el margen mínimo de la sucursal." onClose={onClose} busy={save.isPending}>
    {promotion && fresh.isPending ? <Loading /> : <form className="stack-form" onSubmit={submit}>
      <label>Producto<select required disabled={!!promotion} value={v.productoId} onChange={set('productoId')}><option value="">Selecciona un producto</option>{products.data?.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
      <div className="form-two"><label>Tipo<select value={v.tipo} onChange={set('tipo')}><option value="PORCENTAJE">Porcentaje</option><option value="DOS_X_UNO">2 × 1</option><option value="PRECIO_FIJO">Precio fijo</option></select></label>
        {v.tipo !== 'DOS_X_UNO' && <label>{v.tipo === 'PORCENTAJE' ? 'Descuento (%)' : 'Precio (MXN)'}<input type="number" min="0" step="0.01" required value={v.valor} onChange={set('valor')} /></label>}</div>
      <div className="form-two"><label>Inicia<input type="date" required value={v.fechaInicio} onChange={set('fechaInicio')} /></label><label>Termina<input type="date" required value={v.fechaFin} onChange={set('fechaFin')} /></label></div>
      <label>Explicación<input maxLength={500} placeholder="Por qué conviene esta promoción" value={v.explicacion} onChange={set('explicacion')} /></label>
      {!promotion && <label className="check-label"><input type="checkbox" checked={activar} onChange={e => setActivar(e.target.checked)} />Activarla de inmediato</label>}
      {invalid && <Notice error message="La fecha de término debe ser igual o posterior al inicio." />}
      {save.isError && <Notice error message={save.error.message} />}
      <div className="modal-actions"><button type="button" className="button outlined" onClick={onClose} disabled={save.isPending}>Cancelar</button><button className="button primary" disabled={!online || save.isPending || invalid}>{save.isPending ? 'Guardando…' : 'Guardar'}</button></div>
    </form>}
  </Modal>
}

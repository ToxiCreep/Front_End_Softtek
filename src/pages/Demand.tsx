import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Box, RefreshCw, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { api, quantity, shiftDate, shortDate, today } from '../api'
import type { Schema } from '../api'
import { BarChart, Chart, Empty, ErrorState, Loading, Notice, PageTitle, SectionHeading, useOnline } from '../ui'
import type { PrediccionDetalle, Precision } from '../backend-types'

export default function Demand() {
  const client = useQueryClient()
  const online = useOnline()
  const [id, setId] = useState('1')
  const [notice, setNotice] = useState('')
  const [chartView, setChartView] = useState<'pedido' | 'dia'>('pedido')
  const products = useQuery({ queryKey: ['productos', '', ''], queryFn: () => api<Schema['Producto'][]>('/productos') })
  const configuration = useQuery({ queryKey: ['configuracion'], queryFn: () => api<Schema['Configuracion']>('/configuracion') })
  const from = shiftDate(today(), 1)
  const until = shiftDate(today(), 7)
  const comparison = useQuery({ queryKey: ['comparacion', id, from], queryFn: () => api<Schema['PrediccionComparacion'][]>(`/predicciones/comparar?productoId=${id}&desde=${from}&hasta=${until}`), enabled: !!id })
  const reorders = useQuery({ queryKey: ['reabasto'], queryFn: () => api<Schema['Reabasto'][]>('/inventario/reabasto') })
  const refresh = useMutation({ mutationFn: () => api<Schema['PrediccionGeneracion']>('/predicciones/generar', { method: 'POST', body: JSON.stringify({ dias: 7, productoIds: [Number(id)], modelo: configuration.data?.proveedorIA ? 'AMBOS' : 'BASE' }) }), onSuccess: () => { client.invalidateQueries({ queryKey: ['comparacion'] }); client.invalidateQueries({ queryKey: ['reabasto'] }); setNotice('Estimación actualizada para los próximos 7 días.') } })
  const product = products.data?.find(p => p.id === Number(id))
  const reorder = reorders.data?.find(p => p.productoId === Number(id))
  const availableModel = configuration.data?.proveedorIA ? 'ia' : 'base'
  const estimates = (comparison.data || []).map(p => p[availableModel]?.cantidadPredicha).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const estimated = estimates.length ? estimates.reduce((sum, value) => sum + value, 0) : null
  const estimateLabel = estimates.length > 0 && estimates.length < 7 ? `Venta estimada · ${estimates.length} de 7 días` : 'Venta estimada · 7 días'
  return <>
    <PageTitle title="Demanda" description="Mira cuántas unidades podrías vender y decide cuánto pedir."><button className="button primary" disabled={!online || refresh.isPending || !product || !configuration.data} onClick={() => refresh.mutate()}><RefreshCw size={18} aria-hidden="true" />{refresh.isPending ? 'Calculando…' : 'Actualizar estimación'}</button></PageTitle>
    <div className="demand-select"><label>Producto<select value={id} onChange={e => { setId(e.target.value); setNotice(''); refresh.reset() }}>{products.data?.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label><span className="date-range-pill">Próximos 7 días</span></div>
    {notice && <Notice message={notice} />}{refresh.isError && <Notice error message={refresh.error.message} />}
    {products.isError || comparison.isError || configuration.isError ? <ErrorState error={products.error || comparison.error || configuration.error} retry={() => { products.refetch(); comparison.refetch(); configuration.refetch() }} /> : products.isPending || comparison.isPending || configuration.isPending ? <Loading /> : <>
      <div className="demand-stat-grid"><article className="demand-stat"><span className="summary-icon blue"><Box size={23} aria-hidden="true" /></span><div><span>Tienes ahora</span><strong>{product?.stockActual ?? '—'}<small> unidades</small></strong></div></article><article className="demand-stat"><span className="summary-icon green"><Sparkles size={23} aria-hidden="true" /></span><div><span>{estimateLabel}</span><strong>{estimated === null ? '—' : quantity(estimated)}<small> unidades</small></strong></div></article><article className="demand-stat"><span className="summary-icon amber"><ArrowRight size={23} aria-hidden="true" /></span><div><span>Pedido sugerido</span><strong>{reorders.isError ? '—' : reorders.isPending ? '…' : reorder ? reorder.cantidadAPedir : '—'}<small> unidades</small></strong></div></article></div>
      <section className="panel demand-chart"><SectionHeading title={chartView === 'pedido' ? 'Existencias y demanda' : 'Estimación por día'}><div className="chart-switch" aria-label="Vista de demanda"><button aria-pressed={chartView === 'pedido'} onClick={() => setChartView('pedido')}>Para tu pedido</button><button aria-pressed={chartView === 'dia'} onClick={() => setChartView('dia')}>Por día</button></div></SectionHeading>
        {chartView === 'pedido' ? <><BarChart labels={['Existencias actuales', estimateLabel, 'Existencias recomendadas']} series={[{ label: 'Unidades', color: 'var(--chart-blue)', values: [product?.stockActual ?? null, estimated, reorder && !reorders.isError ? reorder.stockRecomendado : null] }]} unit="unidades" description={`Existencias actuales, venta estimada en 7 días y existencia recomendada para ${product?.nombre}.`} /><p className="chart-note">La venta estimada es una previsión. El pedido sugerido considera también los tiempos del proveedor.</p></> : comparison.data.some(p => p.base) ? <Chart dates={comparison.data.map(p => p.fecha)} series={[{ label: 'Cálculo básico', color: 'var(--chart-blue)', values: comparison.data.map(p => p.base?.cantidadPredicha ?? null) }]} description={`Unidades estimadas de ${product?.nombre} para cada uno de los próximos 7 días. Son estimaciones, no ventas realizadas.`} /> : <Empty title="Todavía no hay una estimación" description="Usa Actualizar estimación para calcular los próximos 7 días." />}
      </section>
      {reorders.isError && <Notice error message="No pudimos cargar el pedido sugerido." />}
      <section className="panel reorder-panel"><div><h2>Para tu próximo pedido</h2>{reorder && !reorders.isError && <><p className="reorder-guidance">Con tus existencias actuales, se sugiere pedir {quantity(reorder.cantidadAPedir)} unidades.</p><dl><div><dt>Existencias recomendadas</dt><dd>{reorder.stockRecomendado} unidades</dd></div><div><dt>Fecha recomendada</dt><dd>{shortDate(reorder.fechaObjetivo)}</dd></div></dl></>}</div><Link to="/inventario" className="button outlined">Revisar existencias<ArrowRight size={17} aria-hidden="true" /></Link></section>
      <Detalle productoId={Number(id)} desde={from} hasta={until} />
      <PrecisionModelos />
    </>}
  </>
}

/** Predicciones guardadas con su rango probable (GET /predicciones). */
function Detalle({ productoId, desde, hasta }: { productoId: number; desde: string; hasta: string }) {
  const lista = useQuery({ queryKey: ['comparacion', 'detalle', productoId, desde], queryFn: () => api<PrediccionDetalle[]>(`/predicciones?productoId=${productoId}&desde=${desde}&hasta=${hasta}`) })
  const basicas = Array.isArray(lista.data) ? lista.data.filter(p => p.modelo === 'BASE') : []
  if (lista.isPending || lista.isError || !basicas.length) return null
  return <section className="panel page-section"><SectionHeading title="Detalle de la estimación" description="Rango probable de venta por día y lo que convendría tener en existencia." />
    <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Venta estimada</th><th>Rango probable</th><th>Existencia recomendada</th><th>Pedir</th></tr></thead>
      <tbody>{basicas.map(p => <tr key={p.id}><td>{shortDate(p.fechaObjetivo)}</td><td>{quantity(p.cantidadPredicha)}</td><td>{quantity(p.limiteInferior)} – {quantity(p.limiteSuperior)}</td><td>{p.stockRecomendado}</td><td>{p.cantidadAPedir}</td></tr>)}</tbody></table></div>
  </section>
}

/** Qué tan bien le atinó cada modelo a las ventas reales (GET /predicciones/precision). */
function PrecisionModelos() {
  const precision = useQuery({ queryKey: ['precision'], queryFn: () => api<Precision>('/predicciones/precision') })
  if (precision.isPending || precision.isError || !Array.isArray(precision.data?.modelos) || !precision.data.modelos.length) return null
  return <section className="panel page-section"><SectionHeading title="Qué tan precisas han sido las estimaciones" description={`Comparación contra ventas reales del ${shortDate(precision.data.desde)} al ${shortDate(precision.data.hasta)}.`} />
    <div className="result-grid">{precision.data.modelos.map(m => <div key={m.modelo}><span>{m.modelo === 'IA' ? 'Con inteligencia artificial' : 'Cálculo básico'} · {m.puntos} días-producto · error ponderado {quantity(m.wape)}%</span><strong>{quantity(m.precision)}%</strong></div>)}</div>
  </section>
}

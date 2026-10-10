import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Box, CalendarDays, CheckCheck, CircleDollarSign, PackageCheck, ReceiptText, ShieldCheck, Sparkles, Tag, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'
import { api, money, shiftDate, shortDate, today } from '../api'
import type { Schema } from '../api'
import { Chart, Empty, ErrorState, Loading, PageTitle, SectionHeading, TextLink } from '../ui'

export default function Dashboard() {
  const [days, setDays] = useState(6)
  const desde = shiftDate(today(), -days)
  const query = `desde=${desde}&hasta=${today()}`
  const dashboard = useQuery({ queryKey: ['dashboard', desde], queryFn: () => api<Schema['DashboardResumen']>(`/dashboard/resumen?${query}`) })
  const series = useQuery({ queryKey: ['ventas', desde], queryFn: () => api<Schema['ResumenVentasFila'][]>(`/ventas/resumen?${query}&agrupar=dia`) })
  const alerts = useQuery({ queryKey: ['alertas'], queryFn: () => api<Schema['InventarioAlerta'][]>('/inventario/alertas') })
  const promos = useQuery({ queryKey: ['promociones', 'SUGERIDA'], queryFn: () => api<Schema['Promocion'][]>('/promociones?estado=SUGERIDA') })
  const configuration = useQuery({ queryKey: ['configuracion'], queryFn: () => api<Schema['Configuracion']>('/configuracion') })
  const lowStock = alerts.data?.filter(a => ['AGOTADO', 'BAJO_STOCK'].includes(a.tipo)) || []
  const overStock = alerts.data?.filter(a => a.tipo === 'SOBRESTOCK') || []
  return <>
    <PageTitle title="Inicio" />
    <section className="overview-hero" aria-label="Resumen de pendientes">
      <div className="hero-content"><h2>Empieza por lo importante.</h2>{alerts.data && promos.data && <p className="hero-summary">{pendingSummary(lowStock.length, promos.data.length)}</p>}<Link className="button hero-button" to="/inventario?atencion=true">Revisar productos<ArrowRight size={18} aria-hidden="true" /></Link></div>
      <div className="hero-art" aria-hidden="true"><div className="hero-chart-card"><div className="hero-art-top"><span><Box size={25} /></span><CheckCheck size={22} /></div><div className="hero-art-lines"><span /><span /></div><svg viewBox="0 0 180 88" fill="none"><path d="M0 81H180" stroke="#dde3db" /><rect x="8" y="57" width="23" height="24" rx="5" fill="#e2ebce" /><rect x="42" y="43" width="23" height="38" rx="5" fill="#d3e1b8" /><rect x="76" y="49" width="23" height="32" rx="5" fill="#c1d797" /><rect x="110" y="23" width="23" height="58" rx="5" fill="#84bd00" /><rect x="144" y="8" width="23" height="73" rx="5" fill="#002855" /></svg></div><span className="hero-spark"><Sparkles size={23} /></span><span className="hero-package"><PackageCheck size={29} /></span></div>
    </section>
    <div className="overview-heading"><div><h2>Así va tu negocio</h2><span>Pesos mexicanos</span></div><div className="period-control" aria-label="Periodo del resumen"><button aria-pressed={days === 0} onClick={() => setDays(0)}>Hoy</button><button aria-pressed={days === 6} onClick={() => setDays(6)}>Últimos 7 días</button></div></div>
    {dashboard.isPending ? <Loading /> : dashboard.isError ? <ErrorState error={dashboard.error} retry={() => dashboard.refetch()} /> : <div className="metric-grid">{[
      { label: 'Ventas', value: money(dashboard.data.actual.ingresos), description: 'Dinero recibido por tus ventas.', icon: CircleDollarSign, change: dashboard.data.variacionPorcentual.ingresos },
      { label: 'Ganancia bruta', value: money(dashboard.data.actual.margen), description: 'Ventas menos el costo de los productos.', icon: TrendingUp, change: dashboard.data.variacionPorcentual.margen },
      { label: 'Ventas registradas', value: dashboard.data.actual.tickets, description: 'Número de tickets en este periodo.', icon: ReceiptText, change: dashboard.data.variacionPorcentual.tickets },
      { label: 'Pérdidas de producto', value: money(dashboard.data.actual.perdidas), description: 'Por daño o caducidad.', icon: ShieldCheck, change: null },
    ].map(m => <article className="metric-card" key={m.label}><div className="metric-top">{m.label}<m.icon size={18} aria-hidden="true" /></div><div className="metric-value">{m.value}</div>{m.change !== null && <div className="metric-change"><strong>{new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(m.change)}%</strong><span>respecto al periodo anterior</span></div>}<p className="metric-description">{m.description}</p></article>)}</div>}
    <section className="attention-section" aria-label="Lo que necesita atención"><SectionHeading title="Lo que necesita atención" />
      {alerts.isError || promos.isError ? <ErrorState error={alerts.error || promos.error} retry={() => { alerts.refetch(); promos.refetch() }} /> : alerts.isPending || promos.isPending ? <Loading /> : <div className="action-grid">{[
        { count: lowStock.length, title: 'Evita quedarte sin productos', description: lowStock.length ? 'Revisa cuáles necesitas reponer para seguir vendiendo.' : 'Por ahora no hay productos que necesites reponer.', icon: AlertTriangle, to: '/inventario?atencion=true', action: 'Revisar existencias' },
        { count: promos.data.length, title: 'Revisa tus promociones', description: promos.data.length ? 'Revisa las sugerencias y decide cuáles te convienen. Tú eliges cuáles activar.' : 'No tienes sugerencias pendientes por revisar.', icon: Tag, to: '/promociones', action: 'Ver promociones' },
        { count: overStock.length, title: 'Aprovecha lo que tienes de más', description: overStock.length ? 'Tienes más unidades de las recomendadas. Revisa si conviene una promoción.' : 'No hay productos con existencias de más.', icon: Box, to: '/inventario?excedente=true', action: 'Ver productos' },
      ].map(item => <article className="action-card" key={item.title}><div className="action-card-top"><span className="action-icon blue"><item.icon size={22} aria-hidden="true" /></span><strong className="small-badge">{item.count}</strong></div><h3>{item.title}</h3><p className="action-description">{item.description}</p><TextLink to={item.to}>{item.action}</TextLink></article>)}</div>}
    </section>
    <div className="dashboard-bottom"><section className="panel sales-panel"><SectionHeading title="Ventas por día" description={days === 0 ? 'Ventas de hoy.' : `Del ${shortDate(desde)} al ${shortDate(today())}.`}><CalendarDays size={20} aria-hidden="true" /></SectionHeading>{series.isPending ? <Loading /> : series.isError ? <ErrorState error={series.error} retry={() => series.refetch()} /> : !series.data.length ? <Empty title="Aún no hay ventas" description="Registra una venta para ver el resumen." /> : <Chart dates={series.data.map(s => s.periodo)} series={[{ label: 'Ventas en pesos', color: 'var(--chart-blue)', values: series.data.map(s => s.ingresos) }]} currency description="Ingresos por día del periodo seleccionado, expresados en pesos mexicanos." />}</section>
      <section className="panel insight-card"><span className="summary-icon blue"><Sparkles size={24} aria-hidden="true" /></span><h2>Prepara tu próximo pedido</h2><p>Consulta cuánto podrías vender y qué conviene pedir. Son estimaciones; tú decides.</p>{configuration.data && <p className="insight-status">Asistencia inteligente {configuration.data.iaHabilitada ? 'activada' : 'desactivada'}.</p>}<TextLink to="/demanda">Ver estimación</TextLink></section>
    </div>
  </>
}

export function pendingSummary(products: number, promotions: number) {
  const stock = products === 0 ? 'No hay productos que necesites reponer' : products === 1 ? '1 producto necesita existencias' : `${products} productos necesitan existencias`
  const offers = promotions === 0 ? 'no tienes promociones pendientes' : promotions === 1 ? 'tienes 1 promoción por revisar' : `tienes ${promotions} promociones por revisar`
  return `${stock} y ${offers}. Te acompañamos paso a paso.`
}

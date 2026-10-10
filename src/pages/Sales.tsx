import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Award, CalendarDays, Clock, ReceiptText, Star, TrendingUp, UserRound } from 'lucide-react'
import { api, exactMoney, money, quantity, shiftDate, shortDate, today } from '../api'
import { fechaHora } from '../backend-types'
import type { Pagina, RecordsVentas, ResumenAgrupado, Ticket, VentaLinea } from '../backend-types'
import { Empty, ErrorState, Loading, Modal, PageTitle, SectionHeading } from '../ui'

const agrupaciones = { categoria: 'Categoría', producto: 'Producto', diaSemana: 'Día de la semana', hora: 'Hora del día', semana: 'Semana', mes: 'Mes' } as const
type Agrupar = keyof typeof agrupaciones

export default function Sales() {
  const [days, setDays] = useState(29)
  const [agrupar, setAgrupar] = useState<Agrupar>('categoria')
  const [page, setPage] = useState(0)
  const [ticket, setTicket] = useState<string | null>(null)
  const desde = shiftDate(today(), -days)
  const query = `desde=${desde}&hasta=${today()}`
  const records = useQuery({ queryKey: ['ventas', 'records', desde], queryFn: () => api<RecordsVentas>(`/ventas/records?${query}`) })
  const resumen = useQuery({ queryKey: ['ventas', 'resumen', desde, agrupar], queryFn: () => api<ResumenAgrupado[]>(`/ventas/resumen?${query}&agrupar=${agrupar}`) })
  const historial = useQuery({ queryKey: ['ventas', 'lista', desde, page], queryFn: () => api<Pagina<VentaLinea>>(`/ventas?${query}&page=${page}&size=20`) })
  const r = records.data

  return <>
    <PageTitle title="Ventas" description="Tus récords, cómo se reparten las ventas y el detalle de cada ticket." />
    <div className="overview-heading"><div><h2>Periodo</h2><span>Pesos mexicanos</span></div><div className="period-control" aria-label="Periodo">
      {[[6, '7 días'], [29, '30 días'], [89, '90 días']].map(([value, label]) => <button key={value} aria-pressed={days === value} onClick={() => { setDays(value as number); setPage(0) }}>{label}</button>)}</div></div>

    {records.isPending ? <Loading /> : records.isError ? <ErrorState error={records.error} retry={() => records.refetch()} /> : r && <>
      <div className="metric-grid">{[
        { label: 'Ingresos', value: money(r.totales.ingresos), icon: TrendingUp },
        { label: 'Ganancia bruta', value: money(r.totales.margen), icon: TrendingUp },
        { label: 'Tickets', value: r.totales.tickets, icon: ReceiptText },
        { label: 'Ticket promedio', value: exactMoney(r.totales.ticketPromedio), icon: ReceiptText },
      ].map(m => <article className="metric-card" key={m.label}><div className="metric-top">{m.label}<m.icon size={18} aria-hidden="true" /></div><div className="metric-value">{m.value}</div></article>)}</div>
      <section className="page-section"><SectionHeading title="Récords del periodo" /><div className="record-grid">
        {r.mejorDia && <Record icon={CalendarDays} label="Mejor día" value={shortDate(r.mejorDia.fecha)} detail={`${money(r.mejorDia.ingresos)} · ${r.mejorDia.tickets} tickets`} />}
        {r.mejorHora && <Record icon={Clock} label="Mejor hora" value={`${String(r.mejorHora.hora).padStart(2, '0')}:00`} detail={`${quantity(r.mejorHora.ticketsPromedioPorDia)} tickets por día en promedio`} />}
        {r.mejorDiaSemana && <Record icon={CalendarDays} label="Mejor día de la semana" value={r.mejorDiaSemana.nombre} detail={money(r.mejorDiaSemana.ingresos)} />}
        {r.productoEstrella && <Record icon={Star} label="Producto estrella" value={r.productoEstrella.nombre} detail={`${r.productoEstrella.unidades} unidades`} />}
        {r.productoMasRentable && <Record icon={Award} label="Más rentable" value={r.productoMasRentable.nombre} detail={`${money(r.productoMasRentable.margen)} de ganancia`} />}
        {r.mejorEmpleado && <Record icon={UserRound} label="Mejor vendedor" value={r.mejorEmpleado.nombre} detail={`${money(r.mejorEmpleado.ingresos)} · ${r.mejorEmpleado.tickets} tickets`} />}
        {r.ticketMasAlto && <Record icon={ReceiptText} label="Ticket más alto" value={exactMoney(r.ticketMasAlto.total)} detail={`${r.ticketMasAlto.articulos} artículos`} onClick={() => setTicket(r.ticketMasAlto!.ticket)} />}
      </div></section>
    </>}

    <section className="panel page-section"><SectionHeading title="Cómo se reparten las ventas"><select aria-label="Agrupar por" value={agrupar} onChange={e => setAgrupar(e.target.value as Agrupar)}>{Object.entries(agrupaciones).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></SectionHeading>
      {resumen.isPending ? <Loading /> : resumen.isError ? <ErrorState error={resumen.error} retry={() => resumen.refetch()} /> : !resumen.data.length ? <Empty title="Sin ventas en este periodo" description="Prueba con un periodo más largo." /> :
        <div className="table-scroll"><table><thead><tr><th>{agrupaciones[agrupar]}</th><th>Unidades</th><th>Ingresos</th><th>Ganancia bruta</th><th>Tickets</th></tr></thead>
          <tbody>{resumen.data.map(f => <tr key={f.periodo}><td>{f.etiqueta || f.periodo}</td><td>{f.unidades}</td><td>{exactMoney(f.ingresos)}</td><td>{exactMoney(f.margen)}</td><td>{f.tickets}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="panel page-section"><SectionHeading title="Historial de ventas" description="Cada renglón es un producto vendido. Abre el ticket para ver la venta completa." />
      {historial.isPending ? <Loading /> : historial.isError ? <ErrorState error={historial.error} retry={() => historial.refetch()} /> : !historial.data.contenido.length ? <Empty title="Sin ventas" description="No hay ventas registradas en este periodo." /> : <>
        <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Ticket</th><th>Producto</th><th>Cantidad</th><th>Descuento</th><th>Total</th></tr></thead>
          <tbody>{historial.data.contenido.map(v => <tr key={v.id}><td>{fechaHora(v.fechaHora)}</td><td><button className="link-button" onClick={() => setTicket(v.ticket)}>{v.ticket}</button></td><td>{v.productoNombre}</td><td>{v.cantidad}</td><td>{v.descuentoAplicado ? exactMoney(v.descuentoAplicado) : '—'}</td><td>{exactMoney(v.total)}</td></tr>)}</tbody></table></div>
        <div className="pager"><button className="button outlined" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {historial.data.pagina + 1} de {Math.max(1, historial.data.totalPaginas)} · {historial.data.totalElementos} renglones</span><button className="button outlined" disabled={page + 1 >= historial.data.totalPaginas} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>
      </>}
    </section>
    {ticket && <TicketModal ticket={ticket} onClose={() => setTicket(null)} />}
  </>
}

function Record({ icon: Icon, label, value, detail, onClick }: { icon: typeof Star; label: string; value: string; detail: string; onClick?: () => void }) {
  return <article className="metric-card record-card"><div className="metric-top">{label}<Icon size={18} aria-hidden="true" /></div><strong>{value}</strong><span>{detail}</span>{onClick && <button className="link-button" onClick={onClick}>Ver ticket</button>}</article>
}

function TicketModal({ ticket, onClose }: { ticket: string; onClose: () => void }) {
  const detalle = useQuery({ queryKey: ['ticket', ticket], queryFn: () => api<Ticket>(`/ventas/ticket/${encodeURIComponent(ticket)}`) })
  return <Modal title={`Ticket ${ticket}`} description={detalle.data ? fechaHora(detalle.data.fechaHora) : undefined} onClose={onClose}>
    {detalle.isPending ? <Loading /> : detalle.isError ? <ErrorState error={detalle.error} retry={() => detalle.refetch()} /> : <>
      <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead>
        <tbody>{detalle.data.lineas.map(l => <tr key={l.id}><td>{l.productoNombre}</td><td>{l.cantidad}</td><td>{exactMoney(l.precioUnitario)}</td><td>{exactMoney(l.total)}</td></tr>)}</tbody></table></div>
      <dl className="settings-facts"><div><dt>Subtotal</dt><dd>{exactMoney(detalle.data.subtotal)}</dd></div><div><dt>Descuento</dt><dd>{exactMoney(detalle.data.descuento)}</dd></div><div><dt>Total</dt><dd>{exactMoney(detalle.data.total)}</dd></div></dl>
    </>}
    <div className="modal-actions"><button className="button primary" onClick={onClose}>Cerrar</button></div>
  </Modal>
}

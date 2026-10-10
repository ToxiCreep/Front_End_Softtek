import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Pencil } from 'lucide-react'
import { api, shiftDate, today } from '../api'
import { temporadas } from '../backend-types'
import type { Contexto, Temporada } from '../backend-types'
import { Empty, ErrorState, Loading, Modal, Notice, PageTitle, SectionHeading, useOnline } from '../ui'

const largo = (fecha: string) => new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00Z`))

/** Calendario de contexto: festivos, quincenas, temporada y clima que usan las predicciones. */
export default function Calendar() {
  const client = useQueryClient()
  const online = useOnline()
  const [notice, setNotice] = useState('')
  const [dias, setDias] = useState(30)
  const [editar, setEditar] = useState<string | null>(null)
  const desde = today()
  const hasta = shiftDate(desde, dias)
  const lista = useQuery({ queryKey: ['contexto', desde, dias], queryFn: () => api<Contexto[]>(`/contexto?desde=${desde}&hasta=${hasta}`) })
  const anio = Number(desde.slice(0, 4))
  const generar = useMutation({ mutationFn: (year: number) => api<Contexto[]>(`/contexto/generar?anio=${year}`, { method: 'POST' }),
    onSuccess: (data, year) => { client.invalidateQueries({ queryKey: ['contexto'] }); setNotice(`Calendario ${year} generado: ${data.length} días con festivos, quincenas y temporadas de México.`) } })

  return <>
    <PageTitle title="Calendario" description="Festivos, quincenas y temporadas que el algoritmo toma en cuenta para estimar la demanda.">
      <div className="heading-actions">{[anio, anio + 1].map(y => <button key={y} className="button outlined" disabled={!online || generar.isPending} onClick={() => generar.mutate(y)}><CalendarPlus size={17} aria-hidden="true" />Generar {y}</button>)}</div>
    </PageTitle>
    {notice && <Notice message={notice} />}{generar.isError && <Notice error message={generar.error.message} />}
    <section className="panel page-section"><SectionHeading title="Próximos días"><div className="period-control">{[[14, '2 semanas'], [30, '30 días'], [90, '90 días']].map(([v, l]) => <button key={v} aria-pressed={dias === v} onClick={() => setDias(v as number)}>{l}</button>)}</div></SectionHeading>
      {lista.isPending ? <Loading /> : lista.isError ? <ErrorState error={lista.error} retry={() => lista.refetch()} /> : !lista.data.length ? <Empty title="No hay días registrados" description={`Usa Generar ${anio} para llenar el calendario automáticamente.`} /> :
        <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Evento</th><th>Quincena</th><th>Temporada</th><th>Clima</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>{lista.data.map(c => <tr key={c.fecha}><td>{largo(c.fecha)}</td><td>{c.esFestivo ? <strong>{c.nombreEvento || 'Festivo'}</strong> : c.nombreEvento || '—'}</td><td>{c.esQuincena ? 'Sí' : '—'}</td>
            <td>{c.temporada ? temporadas[c.temporada] : '—'}</td><td>{[c.clima, c.temperatura != null ? `${c.temperatura} °C` : ''].filter(Boolean).join(' · ') || '—'}</td>
            <td className="row-actions"><button className="icon-button" aria-label={`Editar ${c.fecha}`} disabled={!online} onClick={() => setEditar(c.fecha)}><Pencil size={16} /></button></td></tr>)}</tbody></table></div>}
      <div className="filter-row"><button className="text-button" disabled={!online} onClick={() => setEditar(desde)}>Editar otro día…</button></div>
    </section>
    {editar && <DiaForm fecha={editar} onClose={() => setEditar(null)} onSaved={m => { client.invalidateQueries({ queryKey: ['contexto'] }); setEditar(null); setNotice(m) }} />}
  </>
}

function DiaForm({ fecha: inicial, onClose, onSaved }: { fecha: string; onClose: () => void; onSaved: (message: string) => void }) {
  const online = useOnline()
  const [fecha, setFecha] = useState(inicial)
  const actual = useQuery({ queryKey: ['contexto', 'dia', fecha], queryFn: () => api<Contexto>(`/contexto/${fecha}`), retry: false })
  const base = actual.data
  const [form, setForm] = useState<Partial<Contexto>>({})
  const v = { esFestivo: false, nombreEvento: '', esQuincena: false, temporada: 'NORMAL' as Temporada, clima: '', temperatura: null as number | null, ...base, ...form }
  const save = useMutation({ mutationFn: () => api<Contexto>(`/contexto/${fecha}`, { method: 'PUT', body: JSON.stringify({ fecha, esFestivo: v.esFestivo, nombreEvento: v.nombreEvento || null,
    esQuincena: v.esQuincena, temporada: v.temporada, clima: v.clima || null, temperatura: v.temperatura }) }), onSuccess: c => onSaved(`Día ${c.fecha} guardado.`) })
  function submit(event: FormEvent) { event.preventDefault(); if (online && !save.isPending) save.mutate() }
  return <Modal title="Editar día" description="Si el día no existe se crea. Esto cambia las próximas estimaciones de demanda." onClose={onClose} busy={save.isPending}>
    <form className="stack-form" onSubmit={submit}>
      <label>Fecha<input type="date" required value={fecha} onChange={e => { setFecha(e.target.value); setForm({}) }} /></label>
      {actual.isPending ? <Loading /> : <>
        <label className="check-label"><input type="checkbox" checked={!!v.esFestivo} onChange={e => setForm({ ...form, esFestivo: e.target.checked })} />Es día festivo</label>
        <label>Evento<input maxLength={100} placeholder="Ejemplo: Buen Fin" value={v.nombreEvento ?? ''} onChange={e => setForm({ ...form, nombreEvento: e.target.value })} /></label>
        <label className="check-label"><input type="checkbox" checked={!!v.esQuincena} onChange={e => setForm({ ...form, esQuincena: e.target.checked })} />Es día de quincena</label>
        <label>Temporada<select value={v.temporada ?? 'NORMAL'} onChange={e => setForm({ ...form, temporada: e.target.value as Temporada })}>{Object.entries(temporadas).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div className="form-two"><label>Clima<input maxLength={50} placeholder="Soleado" value={v.clima ?? ''} onChange={e => setForm({ ...form, clima: e.target.value })} /></label>
          <label>Temperatura (°C)<input type="number" step="0.1" value={v.temperatura ?? ''} onChange={e => setForm({ ...form, temperatura: e.target.value === '' ? null : Number(e.target.value) })} /></label></div>
      </>}
      {save.isError && <Notice error message={save.error.message} />}
      <div className="modal-actions"><button type="button" className="button outlined" onClick={onClose} disabled={save.isPending}>Cancelar</button><button className="button primary" disabled={!online || save.isPending || actual.isPending}>{save.isPending ? 'Guardando…' : 'Guardar día'}</button></div>
    </form>
  </Modal>
}

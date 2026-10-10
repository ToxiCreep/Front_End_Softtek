import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Sparkles, Trash2, Users } from 'lucide-react'
import { api, exactMoney, money, quantity } from '../api'
import { dias, hora, roles } from '../backend-types'
import type { CoberturaRol, DiaPlantilla, Empleado, EmpleadoSolicitud, Plantilla, PlantillaSolicitud, RecomendacionPersonal, Rol } from '../backend-types'
import { Empty, ErrorState, Loading, Modal, Notice, PageTitle, SectionHeading, useOnline } from '../ui'

const estados: Record<CoberturaRol['estado'], string> = { OK: 'Cubierto', JUSTO: 'Justo', DEFICIT: 'Faltan personas', EXCESO: 'Personal de más', SIN_DATOS: 'Sin datos' }
const rolOptions = Object.entries(roles) as [Rol, string][]

export default function Staff() {
  const client = useQueryClient()
  const online = useOnline()
  const [notice, setNotice] = useState('')
  const [rol, setRol] = useState<Rol | ''>('')
  const [activos, setActivos] = useState<'true' | 'false' | ''>('true')
  const [empleado, setEmpleado] = useState<Empleado | 'nuevo' | null>(null)
  const [bloque, setBloque] = useState<Plantilla | 'nuevo' | null>(null)
  const [recomendar, setRecomendar] = useState(false)

  const cobertura = useQuery({ queryKey: ['cobertura'], queryFn: () => api<CoberturaRol[]>('/plantillas/cobertura') })
  const semana = useQuery({ queryKey: ['plantillas', 'semana'], queryFn: () => api<DiaPlantilla[]>('/plantillas/semana') })
  const filtros = new URLSearchParams({ ...(rol ? { rol } : {}) }).toString()
  const plantillas = useQuery({ queryKey: ['plantillas', rol], queryFn: () => api<Plantilla[]>(`/plantillas?${filtros}`) })
  const empleadosQuery = new URLSearchParams({ ...(rol ? { rol } : {}), ...(activos ? { activo: activos } : {}) }).toString()
  const empleados = useQuery({ queryKey: ['empleados', rol, activos], queryFn: () => api<Empleado[]>(`/empleados?${empleadosQuery}`) })

  const refrescar = () => { client.invalidateQueries({ queryKey: ['plantillas'] }); client.invalidateQueries({ queryKey: ['cobertura'] }); client.invalidateQueries({ queryKey: ['empleados'] }) }
  const borrar = useMutation({ mutationFn: (id: number) => api<null>(`/plantillas/${id}`, { method: 'DELETE' }), onSuccess: () => { refrescar(); setNotice('Bloque eliminado de la plantilla.') } })
  const activo = useMutation({ mutationFn: (e: Empleado) => api<Empleado>(`/empleados/${e.id}/activo`, { method: 'PATCH', body: JSON.stringify({ activo: !e.activo }) }),
    onSuccess: e => { refrescar(); setNotice(`${e.nombre} ahora está ${e.activo ? 'activo' : 'inactivo'}.`) } })

  const porDia = new Map<number, Plantilla[]>()
  plantillas.data?.forEach(p => porDia.set(p.diaSemana, [...(porDia.get(p.diaSemana) || []), p]))

  return <>
    <PageTitle title="Personal" description="Cuántas personas necesitas por turno y quién está disponible.">
      <button className="button primary" disabled={!online} onClick={() => setRecomendar(true)}><Sparkles size={18} aria-hidden="true" />Recomendar plantilla</button>
    </PageTitle>
    {notice && <Notice message={notice} />}
    {(borrar.isError || activo.isError) && <Notice error message={(borrar.error || activo.error)!.message} />}

    <section className="panel page-section"><SectionHeading title="Cobertura por puesto" description="Horas que pide la plantilla contra las horas que pueden trabajar tus empleados activos." />
      {cobertura.isPending ? <Loading /> : cobertura.isError ? <ErrorState error={cobertura.error} retry={() => cobertura.refetch()} /> : !cobertura.data.length ? <Empty title="Sin datos de cobertura" description="Agrega empleados y bloques de plantilla." /> :
        <div className="table-scroll"><table><thead><tr><th>Puesto</th><th>Horas requeridas</th><th>Horas disponibles</th><th>Pico simultáneo</th><th>Activos</th><th>Faltan</th><th>Estado</th></tr></thead>
          <tbody>{cobertura.data.map(c => <tr key={c.rol}><td>{roles[c.rol]}</td><td>{quantity(c.horasRequeridas)}</td><td>{quantity(c.horasDisponibles)}</td><td>{c.picoSimultaneo}</td><td>{c.empleadosActivos}</td><td>{c.empleadosFaltantes}</td><td><span className={`status status-${c.estado.toLowerCase()}`}>{estados[c.estado]}</span></td></tr>)}</tbody></table></div>}
    </section>

    <div className="filter-row"><label>Puesto<select value={rol} onChange={e => setRol(e.target.value as Rol | '')}><option value="">Todos los puestos</option>{rolOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>

    <section className="panel page-section"><SectionHeading title="Plantilla semanal" description="Bloques de horario con el personal requerido. Los recomendados se pueden regenerar; los manuales se respetan.">
      <button className="button outlined" disabled={!online} onClick={() => setBloque('nuevo')}><Plus size={17} aria-hidden="true" />Agregar bloque</button></SectionHeading>
      {plantillas.isPending ? <Loading /> : plantillas.isError ? <ErrorState error={plantillas.error} retry={() => plantillas.refetch()} /> : !plantillas.data.length ? <Empty title="Todavía no hay plantilla" description="Usa Recomendar plantilla para generarla a partir de tus ventas." /> :
        <div className="table-scroll"><table><thead><tr><th>Día</th><th>Horario</th><th>Puesto</th><th>Personas</th><th>Horas-persona</th><th>Origen</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>{[1, 2, 3, 4, 5, 6, 7].flatMap(d => (porDia.get(d) || []).map((p, i) => <tr key={p.id}>
            <td>{i === 0 ? <strong>{dias[d]}</strong> : ''}{i === 0 && semana.data && <span className="cell-note">{quantity(semana.data.find(s => s.diaSemana === d)?.horasPersona ?? 0)} h-persona en total</span>}</td>
            <td>{hora(p.horaInicio)} – {hora(p.horaFin)}</td><td>{roles[p.rol]}</td><td>{p.personalRequerido}</td><td>{quantity(p.horasPersona)}</td><td>{p.origen === 'MANUAL' ? 'Manual' : 'Recomendado'}</td>
            <td className="row-actions"><button className="icon-button" aria-label={`Editar bloque ${dias[d]} ${hora(p.horaInicio)}`} disabled={!online} onClick={() => setBloque(p)}><Pencil size={16} /></button>
              <button className="icon-button" aria-label={`Eliminar bloque ${dias[d]} ${hora(p.horaInicio)}`} disabled={!online || borrar.isPending} onClick={() => borrar.mutate(p.id)}><Trash2 size={16} /></button></td></tr>))}</tbody></table></div>}
    </section>

    <section className="panel page-section"><SectionHeading title="Empleados" description="Sin borrado: las ventas apuntan a los empleados, así que se desactivan.">
      <div className="heading-actions"><select aria-label="Filtrar por estado" value={activos} onChange={e => setActivos(e.target.value as typeof activos)}><option value="true">Activos</option><option value="false">Inactivos</option><option value="">Todos</option></select>
        <button className="button outlined" disabled={!online} onClick={() => setEmpleado('nuevo')}><Plus size={17} aria-hidden="true" />Agregar empleado</button></div></SectionHeading>
      {empleados.isPending ? <Loading /> : empleados.isError ? <ErrorState error={empleados.error} retry={() => empleados.refetch()} /> : !empleados.data.length ? <Empty title="No hay empleados en esta lista" description="Agrega a tu equipo para calcular la cobertura." /> :
        <div className="table-scroll"><table><thead><tr><th>Nombre</th><th>Puesto</th><th>Costo por hora</th><th>Horas máx. por semana</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>{empleados.data.map(e => <tr key={e.id}><td>{e.nombre}</td><td>{roles[e.rol]}</td><td>{exactMoney(e.costoHora)}</td><td>{e.horasMaxSemana ?? '—'}</td><td>{e.activo ? 'Activo' : 'Inactivo'}</td>
            <td className="row-actions"><button className="icon-button" aria-label={`Editar a ${e.nombre}`} disabled={!online} onClick={() => setEmpleado(e)}><Pencil size={16} /></button>
              <button className="text-button" disabled={!online || activo.isPending} onClick={() => activo.mutate(e)}>{e.activo ? 'Desactivar' : 'Activar'}</button></td></tr>)}</tbody></table></div>}
    </section>

    {empleado && <EmpleadoForm empleado={empleado === 'nuevo' ? null : empleado} onClose={() => setEmpleado(null)} onSaved={m => { refrescar(); setEmpleado(null); setNotice(m) }} />}
    {bloque && <BloqueForm bloque={bloque === 'nuevo' ? null : bloque} onClose={() => setBloque(null)} onSaved={m => { refrescar(); setBloque(null); setNotice(m) }} />}
    {recomendar && <Recomendar onClose={() => setRecomendar(false)} onSaved={m => { refrescar(); setRecomendar(false); setNotice(m) }} />}
  </>
}

function EmpleadoForm({ empleado, onClose, onSaved }: { empleado: Empleado | null; onClose: () => void; onSaved: (message: string) => void }) {
  const online = useOnline()
  const [form, setForm] = useState({ nombre: empleado?.nombre ?? '', rol: empleado?.rol ?? 'CAJERO' as Rol, costoHora: String(empleado?.costoHora ?? ''), horasMaxSemana: String(empleado?.horasMaxSemana ?? 48) })
  const save = useMutation({ mutationFn: () => {
    const body: EmpleadoSolicitud = { nombre: form.nombre.trim(), rol: form.rol, costoHora: Number(form.costoHora), horasMaxSemana: form.horasMaxSemana ? Number(form.horasMaxSemana) : null, activo: empleado?.activo ?? true }
    return api<Empleado>(empleado ? `/empleados/${empleado.id}` : '/empleados', { method: empleado ? 'PUT' : 'POST', body: JSON.stringify(body) })
  }, onSuccess: e => onSaved(empleado ? `Datos de ${e.nombre} actualizados.` : `${e.nombre} se agregó al equipo.`) })
  function submit(event: FormEvent) { event.preventDefault(); if (online && !save.isPending) save.mutate() }
  return <Modal title={empleado ? 'Editar empleado' : 'Agregar empleado'} onClose={onClose} busy={save.isPending}>
    <form className="stack-form" onSubmit={submit}>
      <label>Nombre<input required maxLength={120} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
      <label>Puesto<select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value as Rol })}>{rolOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Costo por hora (MXN)<input required type="number" min="0" step="0.01" inputMode="decimal" value={form.costoHora} onChange={e => setForm({ ...form, costoHora: e.target.value })} /></label>
      <label>Horas máximas por semana<input type="number" min="1" max="168" step="1" inputMode="numeric" value={form.horasMaxSemana} onChange={e => setForm({ ...form, horasMaxSemana: e.target.value })} /></label>
      {save.isError && <Notice error message={save.error.message} />}
      <div className="modal-actions"><button type="button" className="button outlined" onClick={onClose} disabled={save.isPending}>Cancelar</button><button className="button primary" disabled={!online || save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  </Modal>
}

function BloqueForm({ bloque, onClose, onSaved }: { bloque: Plantilla | null; onClose: () => void; onSaved: (message: string) => void }) {
  const online = useOnline()
  const [form, setForm] = useState({ diaSemana: String(bloque?.diaSemana ?? 1), horaInicio: hora(bloque?.horaInicio ?? '09:00'), horaFin: hora(bloque?.horaFin ?? '15:00'), rol: bloque?.rol ?? 'CAJERO' as Rol, personalRequerido: String(bloque?.personalRequerido ?? 1) })
  const invalid = form.horaFin <= form.horaInicio
  const save = useMutation({ mutationFn: () => {
    const body: PlantillaSolicitud = { diaSemana: Number(form.diaSemana), horaInicio: form.horaInicio, horaFin: form.horaFin, rol: form.rol, personalRequerido: Number(form.personalRequerido) }
    return api<Plantilla>(bloque ? `/plantillas/${bloque.id}` : '/plantillas', { method: bloque ? 'PUT' : 'POST', body: JSON.stringify(body) })
  }, onSuccess: p => onSaved(`Bloque del ${p.dia} de ${hora(p.horaInicio)} a ${hora(p.horaFin)} guardado.`) })
  function submit(event: FormEvent) { event.preventDefault(); if (online && !save.isPending && !invalid) save.mutate() }
  return <Modal title={bloque ? 'Editar bloque' : 'Agregar bloque'} description="Un bloque manual no se reemplaza al guardar una recomendación." onClose={onClose} busy={save.isPending}>
    <form className="stack-form" onSubmit={submit}>
      <label>Día<select value={form.diaSemana} onChange={e => setForm({ ...form, diaSemana: e.target.value })}>{dias.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>
      <div className="form-two"><label>Entrada<input type="time" required value={form.horaInicio} onChange={e => setForm({ ...form, horaInicio: e.target.value })} /></label>
        <label>Salida<input type="time" required value={form.horaFin} onChange={e => setForm({ ...form, horaFin: e.target.value })} /></label></div>
      <label>Puesto<select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value as Rol })}>{rolOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Personas requeridas<input type="number" min="0" step="1" required inputMode="numeric" value={form.personalRequerido} onChange={e => setForm({ ...form, personalRequerido: e.target.value })} /></label>
      {invalid && <Notice error message="La hora de salida debe ser posterior a la de entrada." />}
      {save.isError && <Notice error message={save.error.message} />}
      <div className="modal-actions"><button type="button" className="button outlined" onClick={onClose} disabled={save.isPending}>Cancelar</button><button className="button primary" disabled={!online || save.isPending || invalid}>{save.isPending ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  </Modal>
}

function Recomendar({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const online = useOnline()
  const [semanas, setSemanas] = useState('4')
  const preview = useMutation({ mutationFn: () => api<RecomendacionPersonal>(`/plantillas/recomendar?semanas=${semanas}&guardar=false`, { method: 'POST' }) })
  const save = useMutation({ mutationFn: () => api<RecomendacionPersonal>(`/plantillas/recomendar?semanas=${semanas}&guardar=true`, { method: 'POST' }),
    onSuccess: r => onSaved(`Plantilla recomendada guardada: ${r.bloques.length} bloques. Los bloques manuales se conservaron.`) })
  const r = preview.data
  return <Modal title="Recomendar plantilla" description="Se calcula con los tickets por hora de tus ventas recientes. Primero ves la propuesta; tú decides si guardarla." onClose={onClose} busy={save.isPending}>
    <div className="stack-form">
      <label>Semanas de ventas a analizar<select value={semanas} onChange={e => { setSemanas(e.target.value); preview.reset() }}>{[2, 4, 8, 12].map(n => <option key={n} value={n}>{n} semanas</option>)}</select></label>
      {!r && <button className="button outlined" disabled={!online || preview.isPending} onClick={() => preview.mutate()}><Users size={17} aria-hidden="true" />{preview.isPending ? 'Calculando…' : 'Ver propuesta'}</button>}
      {preview.isError && <Notice error message={preview.error.message} />}
      {r && <>
        <div className="result-grid"><div><span>Costo semanal estimado</span><strong>{money(r.costoSemanalEstimado)}</strong></div><div><span>Bloques propuestos</span><strong>{r.bloques.length}</strong></div><div><span>Tickets que atiende una persona por hora</span><strong>{r.transaccionesPorEmpleadoHora}</strong></div></div>
        <div className="table-scroll"><table><thead><tr><th>Puesto</th><th>Horas-persona por semana</th></tr></thead><tbody>{Object.entries(r.horasPersonaPorRol).map(([k, v]) => <tr key={k}><td>{roles[k as Rol] ?? k}</td><td>{quantity(v)}</td></tr>)}</tbody></table></div>
        {r.notas.length > 0 && <ul className="note-list">{r.notas.map(n => <li key={n}>{n}</li>)}</ul>}
      </>}
      {save.isError && <Notice error message={save.error.message} />}
      <div className="modal-actions"><button className="button outlined" onClick={onClose} disabled={save.isPending}>Cancelar</button><button className="button primary" disabled={!online || !r || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Guardando…' : 'Guardar propuesta'}</button></div>
    </div>
  </Modal>
}

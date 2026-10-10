import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Database, Pencil, RefreshCw, ShieldCheck, Sparkles, Store, Upload } from 'lucide-react'
import { api, iaProviders } from '../api'
import type { Schema } from '../api'
import { numeroAProveedor } from '../adapters'
import { tamanos } from '../backend-types'
import type { ConfiguracionExtra, EstadoIa, ProveedorIa, SucursalActiva, Tamano } from '../backend-types'
import { ErrorState, Loading, Modal, Notice, PageTitle, useOnline } from '../ui'

type Configuracion = Schema['Configuracion'] & ConfiguracionExtra

export default function Settings() {
  const client = useQueryClient()
  const online = useOnline()
  const [selection, setSelection] = useState<Schema['CambioIA']['proveedorIA'] | null>(null)
  const [modelo, setModelo] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(false)
  const config = useQuery({ queryKey: ['configuracion'], queryFn: () => api<Configuracion>('/configuracion') })
  // Solo los proveedores con API key en el servidor se pueden elegir.
  const proveedores = useQuery({ queryKey: ['configuracion', 'proveedores'], queryFn: () => api<ProveedorIa[]>('/configuracion/ia/proveedores') })
  const disponible = (value: number) => value === 0 || !Array.isArray(proveedores.data) || proveedores.data.includes(numeroAProveedor(value) as ProveedorIa)
  const mutation = useMutation({ mutationFn: (proveedorIA: Schema['CambioIA']['proveedorIA']) => api<Configuracion>('/configuracion/ia', { method: 'PATCH', body: JSON.stringify({ proveedorIA, ...(modelo.trim() && proveedorIA !== 0 ? { modeloIa: modelo.trim() } : {}) }) }), onSuccess: data => { client.setQueryData(['configuracion'], data); client.invalidateQueries({ queryKey: ['reabasto'] }); client.invalidateQueries({ queryKey: ['comparacion'] }); client.invalidateQueries({ queryKey: ['ia-estado'] }); setSelection(null); setModelo(''); setNotice(data.proveedorIA === 0 ? 'Asistencia inteligente desactivada. Puedes seguir usando las recomendaciones básicas.' : `Proveedor seleccionado: ${iaProviders.find(provider => provider.value === data.proveedorIA)?.label}.`) } })
  return <><PageTitle title="Ajustes" />{notice && <Notice message={notice} />}
    {config.isPending ? <Loading /> : config.isError ? <ErrorState error={config.error} retry={() => config.refetch()} /> : <div className="settings-grid"><section className="panel settings-card"><SectionHeadingIcon icon="store" title="Sucursal" action={<button className="icon-button" aria-label="Editar datos de la sucursal" disabled={!online} onClick={() => setEditing(true)}><Pencil size={17} /></button>} /><dl className="settings-facts"><div><dt>Nombre</dt><dd>{config.data.nombreSucursal}</dd></div><div><dt>Ubicación</dt><dd>{config.data.zona}</dd></div><div><dt>Horario</dt><dd>{config.data.horaApertura} a {config.data.horaCierre}</dd></div><div><dt>Tamaño</dt><dd>{{ PEQUENA: 'Pequeña', MEDIANA: 'Mediana', GRANDE: 'Grande' }[config.data.tamano]}</dd></div><div><dt>Meses de historial</dt><dd>{config.data.mesesHistorico}</dd></div><div><dt>Tickets por empleado por hora</dt><dd>{config.data.transaccionesPorEmpleadoHora}</dd></div></dl></section>
      <section className="panel settings-card"><SectionHeadingIcon icon="sparkles" title="Asistencia inteligente" /><p className="settings-guidance">Ayuda a estimar ventas y preparar tus pedidos. Tú decides qué promociones activar.</p><div className="stack-form settings-provider"><label>Proveedor de asistencia<select value={config.data.proveedorIA} disabled={!online || mutation.isPending} onChange={event => { const value = Number(event.target.value) as Schema['CambioIA']['proveedorIA']; if (value !== config.data.proveedorIA) { mutation.reset(); setNotice(''); setSelection(value) } }}>{iaProviders.map(provider => <option value={provider.value} key={provider.value} disabled={!disponible(provider.value)}>{provider.label}{disponible(provider.value) ? '' : ' (sin llave)'}</option>)}</select></label>{config.data.modeloIa && <p className="field-help">Modelo: <strong>{config.data.modeloIa}</strong></p>}</div><IaEstado /></section>
      <SucursalDemo onChanged={setNotice} />
      <section className="panel settings-card"><SectionHeadingIcon icon="shield" title="Límites de promociones" /><div className="limit-grid"><div><strong>{config.data.descuentoMaximo}%</strong><span>Descuento máximo permitido</span></div><div><strong>{config.data.margenMinimoPromo}%</strong><span>Margen mínimo sobre el costo</span></div></div><p className="settings-guidance">El margen mínimo indica cuánto debe quedar por encima del costo del producto.</p></section>
      <CargaMasiva onLoaded={setNotice} />
    </div>}
    {selection !== null && config.data && <Modal title={selection === 0 ? '¿Desactivar la asistencia inteligente?' : `¿Usar ${iaProviders.find(provider => provider.value === selection)?.label} para la asistencia?`} description={selection === 0 ? 'Las próximas recomendaciones usarán cálculos básicos. Las promociones que ya activaste no cambian.' : 'Cambiará el proveedor seleccionado para las próximas recomendaciones. Tú seguirás decidiendo qué promociones activar.'} onClose={() => setSelection(null)} busy={mutation.isPending}>{selection !== 0 && <div className="stack-form"><label>Modelo (opcional)<input maxLength={80} placeholder="Vacío = el modelo configurado en el servidor" value={modelo} onChange={e => setModelo(e.target.value)} /></label></div>}{mutation.isError && <Notice error message={mutation.error.message} />}<div className="modal-actions"><button className="button outlined" disabled={mutation.isPending} onClick={() => setSelection(null)}>Cancelar</button><button className="button primary" disabled={!online || mutation.isPending} onClick={() => mutation.mutate(selection)}>{mutation.isPending ? 'Guardando…' : 'Confirmar cambio'}</button></div></Modal>}
    {editing && config.data && <ConfigForm config={config.data} onClose={() => setEditing(false)} onSaved={data => { client.setQueryData(['configuracion'], data); client.invalidateQueries({ queryKey: ['promociones'] }); setEditing(false); setNotice('Datos de la sucursal guardados.') }} />}
  </>
}

const headingIcons = { store: Store, sparkles: Sparkles, shield: ShieldCheck, database: Database, upload: Upload }
function SectionHeadingIcon({ title, icon, action }: { title: string; icon: keyof typeof headingIcons; action?: ReactNode }) { const Icon = headingIcons[icon]; return <div className="settings-heading"><span className="summary-icon blue"><Icon size={21} aria-hidden="true" /></span><h2>{title}</h2>{action && <div className="heading-end">{action}</div>}</div> }

function IaEstado() {
  const estado = useQuery({ queryKey: ['ia-estado'], queryFn: () => api<EstadoIa>('/configuracion/ia/estado') })
  if (estado.isPending) return null
  if (estado.isError || !Array.isArray(estado.data?.conLlave)) return <p className="field-help">No pudimos leer el diagnóstico de la IA.</p>
  const e = estado.data
  return <details className="chart-table ia-diagnostico"><summary><Activity size={16} aria-hidden="true" />Diagnóstico de la IA: {e.disponible ? 'lista' : 'no disponible'}</summary>
    <dl className="settings-facts"><div><dt>Proveedor</dt><dd>{e.proveedorConfigurado}{e.modeloConfigurado ? ` · ${e.modeloConfigurado}` : ''}</dd></div><div><dt>Con llave en el servidor</dt><dd>{e.conLlave.join(', ') || 'Ninguno'}</dd></div><div><dt>Llamadas / fallos</dt><dd>{e.llamadas} / {e.fallos}</dd></div>
      <div><dt>Última llamada</dt><dd>{e.ultimaOk == null ? 'Sin llamadas' : `${e.ultimaOk ? 'Correcta' : 'Falló'}${e.ultimaLatenciaMs != null ? ` · ${e.ultimaLatenciaMs} ms` : ''}`}</dd></div>{e.ultimoError && <div><dt>Último error</dt><dd>{e.ultimoError}</dd></div>}</dl>
    <button className="text-button" onClick={() => estado.refetch()}><RefreshCw size={15} aria-hidden="true" /> Actualizar diagnóstico</button></details>
}

function SucursalDemo({ onChanged }: { onChanged: (message: string) => void }) {
  const client = useQueryClient()
  const online = useOnline()
  const base = useQuery({ queryKey: ['sucursal-activa'], queryFn: () => api<SucursalActiva>('/sucursal-activa') })
  // Al cambiar de base, todos los datos en caché son de la otra tienda: se invalidan todas las consultas.
  const cambiar = useMutation({ mutationFn: (tamano: Tamano) => api<SucursalActiva>('/sucursal-activa', { method: 'PUT', body: JSON.stringify({ tamano }) }),
    onSuccess: data => { client.invalidateQueries(); onChanged(`Ahora ves la sucursal de demo ${tamanos[data.activa].toLowerCase()}. Todos los datos se volvieron a cargar.`) } })
  return <section className="panel settings-card"><SectionHeadingIcon icon="database" title="Sucursal de demo" /><p className="settings-guidance">Cambia entre las tres bases de prueba. El cambio aplica para todos los que usen la app.</p>
    {base.isPending ? <Loading /> : base.isError || !Array.isArray(base.data?.disponibles) ? <ErrorState error={base.error} retry={() => base.refetch()} /> : <div className="stack-form settings-provider"><label>Base de datos<select value={base.data.activa} disabled={!online || cambiar.isPending} onChange={e => cambiar.mutate(e.target.value as Tamano)}>{base.data.disponibles.map(t => <option key={t} value={t}>{tamanos[t]}</option>)}</select></label>{cambiar.isPending && <p className="field-help">Cambiando de base…</p>}</div>}
    {cambiar.isError && <Notice error message={cambiar.error.message} />}</section>
}

function ConfigForm({ config, onClose, onSaved }: { config: Configuracion; onClose: () => void; onSaved: (data: Configuracion) => void }) {
  const online = useOnline()
  const [f, setF] = useState({ nombreSucursal: config.nombreSucursal, zona: config.zona ?? '', tamano: config.tamano, horaApertura: config.horaApertura, horaCierre: config.horaCierre,
    margenMinimoPromo: String(config.margenMinimoPromo), descuentoMaximo: String(config.descuentoMaximo), mesesHistorico: String(config.mesesHistorico), transaccionesPorEmpleadoHora: String(config.transaccionesPorEmpleadoHora) })
  const save = useMutation({ mutationFn: () => api<Configuracion>('/configuracion', { method: 'PUT', body: JSON.stringify({ ...f, margenMinimoPromo: Number(f.margenMinimoPromo), descuentoMaximo: Number(f.descuentoMaximo), mesesHistorico: Number(f.mesesHistorico), transaccionesPorEmpleadoHora: Number(f.transaccionesPorEmpleadoHora) }) }), onSuccess: onSaved })
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [key]: e.target.value })
  function submit(event: FormEvent) { event.preventDefault(); if (online && !save.isPending) save.mutate() }
  return <Modal title="Datos de la sucursal" onClose={onClose} busy={save.isPending}>
    <form className="stack-form" onSubmit={submit}>
      <label>Nombre<input required maxLength={100} value={f.nombreSucursal} onChange={set('nombreSucursal')} /></label>
      <label>Ubicación<input maxLength={100} value={f.zona} onChange={set('zona')} /></label>
      <label>Tamaño<select value={f.tamano} onChange={set('tamano')}>{Object.entries(tamanos).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <div className="form-two"><label>Abre<input type="time" required value={f.horaApertura} onChange={set('horaApertura')} /></label><label>Cierra<input type="time" required value={f.horaCierre} onChange={set('horaCierre')} /></label></div>
      <div className="form-two"><label>Margen mínimo (%)<input type="number" min="0" max="100" step="0.1" required value={f.margenMinimoPromo} onChange={set('margenMinimoPromo')} /></label><label>Descuento máximo (%)<input type="number" min="0" max="100" step="0.1" required value={f.descuentoMaximo} onChange={set('descuentoMaximo')} /></label></div>
      <div className="form-two"><label>Meses de historial<input type="number" min="1" step="1" required value={f.mesesHistorico} onChange={set('mesesHistorico')} /></label><label>Tickets por empleado por hora<input type="number" min="1" step="1" required value={f.transaccionesPorEmpleadoHora} onChange={set('transaccionesPorEmpleadoHora')} /></label></div>
      {save.isError && <Notice error message={save.error.message} />}
      <div className="modal-actions"><button type="button" className="button outlined" onClick={onClose} disabled={save.isPending}>Cancelar</button><button className="button primary" disabled={!online || save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  </Modal>
}

const cargas = {
  productos: { label: 'Productos', path: '/productos/lote', ejemplo: '[{"sku":"A-1","nombre":"Leche","categoria":"Lácteos","precioVenta":28,"costo":19}]' },
  empleados: { label: 'Empleados', path: '/empleados/lote', ejemplo: '[{"nombre":"Ana","rol":"CAJERO","costoHora":60,"horasMaxSemana":48}]' },
  ventas: { label: 'Ventas históricas', path: '/ventas/lote', ejemplo: '[{"ticket":"H-1","fechaHora":"2026-09-01T10:15:00","sku":"A-1","cantidad":2}]' },
  movimientos: { label: 'Movimientos de inventario', path: '/inventario/movimientos/lote', ejemplo: '[{"productoId":1,"tipo":"MERMA","cantidad":3,"motivo":"Dañado","fecha":"2026-09-01T09:00:00"}]' },
  contexto: { label: 'Calendario (contexto)', path: '/contexto/lote', ejemplo: '[{"fecha":"2026-11-16","esFestivo":true,"nombreEvento":"Revolución"}]' },
} as const

function CargaMasiva({ onLoaded }: { onLoaded: (message: string) => void }) {
  const client = useQueryClient()
  const online = useOnline()
  const [tipo, setTipo] = useState<keyof typeof cargas>('productos')
  const [texto, setTexto] = useState('')
  const [afectarStock, setAfectarStock] = useState(false)
  const [parseError, setParseError] = useState('')
  const cargar = useMutation({ mutationFn: (filas: unknown[]) => api<unknown>(`${cargas[tipo].path}${tipo === 'movimientos' ? `?afectarStock=${afectarStock}` : ''}`, { method: 'POST', body: JSON.stringify(filas) }),
    onSuccess: (data, filas) => {
      client.invalidateQueries(); setTexto('')
      const r = (data ?? {}) as Record<string, unknown>
      const n = Array.isArray(data) ? data.length : r.creados ?? r.insertados ?? r.insertadas ?? filas.length
      onLoaded(`${cargas[tipo].label}: se cargaron ${n} registros.`)
    } })
  async function archivo(file?: File) { if (file) setTexto(await file.text()) }
  function enviar(event: FormEvent) {
    event.preventDefault(); setParseError('')
    let filas: unknown
    try { filas = JSON.parse(texto) } catch { filas = null }
    if (!Array.isArray(filas) || !filas.length) { setParseError('Pega o sube un arreglo JSON con al menos un registro.'); return }
    cargar.mutate(filas)
  }
  return <section className="panel settings-card limits-card"><SectionHeadingIcon icon="upload" title="Carga masiva" /><p className="settings-guidance">Importa datos en lote desde un archivo JSON. Útil para preparar la demo.</p>
    <form className="stack-form settings-provider" onSubmit={enviar}>
      <label>Qué vas a cargar<select value={tipo} onChange={e => { setTipo(e.target.value as keyof typeof cargas); cargar.reset() }}>{Object.entries(cargas).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></label>
      {tipo === 'movimientos' && <label className="check-label"><input type="checkbox" checked={afectarStock} onChange={e => setAfectarStock(e.target.checked)} />Actualizar las existencias con estos movimientos</label>}
      {tipo === 'ventas' && <p className="field-help">Las ventas históricas no cambian las existencias.</p>}
      <label>Archivo JSON<input type="file" accept="application/json,.json" onChange={e => archivo(e.target.files?.[0])} /></label>
      <label>O pega el contenido<textarea rows={5} value={texto} placeholder={cargas[tipo].ejemplo} onChange={e => setTexto(e.target.value)} /></label>
      {(parseError || cargar.isError) && <Notice error message={parseError || cargar.error!.message} />}
      <div><button className="button primary" disabled={!online || cargar.isPending || !texto.trim()}>{cargar.isPending ? 'Cargando…' : 'Cargar datos'}</button></div>
    </form></section>
}

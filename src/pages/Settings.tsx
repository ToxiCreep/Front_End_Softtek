import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Sparkles, Store } from 'lucide-react'
import { api, iaProviders } from '../api'
import type { Schema } from '../api'
import { ErrorState, Loading, Modal, Notice, PageTitle, useOnline } from '../ui'

export default function Settings() {
  const client = useQueryClient()
  const online = useOnline()
  const [selection, setSelection] = useState<Schema['CambioIA']['proveedorIA'] | null>(null)
  const [notice, setNotice] = useState('')
  const config = useQuery({ queryKey: ['configuracion'], queryFn: () => api<Schema['Configuracion']>('/configuracion') })
  const mutation = useMutation({ mutationFn: (proveedorIA: Schema['CambioIA']['proveedorIA']) => api<Schema['Configuracion']>('/configuracion/ia', { method: 'PATCH', body: JSON.stringify({ proveedorIA }) }), onSuccess: data => { client.setQueryData(['configuracion'], data); client.invalidateQueries({ queryKey: ['reabasto'] }); client.invalidateQueries({ queryKey: ['comparacion'] }); setSelection(null); setNotice(data.proveedorIA === 0 ? 'Asistencia inteligente desactivada. Puedes seguir usando las recomendaciones básicas.' : `Proveedor seleccionado: ${iaProviders.find(provider => provider.value === data.proveedorIA)?.label}.`) } })
  return <><PageTitle title="Ajustes" />{notice && <Notice message={notice} />}
    {config.isPending ? <Loading /> : config.isError ? <ErrorState error={config.error} retry={() => config.refetch()} /> : <div className="settings-grid"><section className="panel settings-card"><SectionHeadingIcon icon="store" title="Sucursal" /><dl className="settings-facts"><div><dt>Nombre</dt><dd>{config.data.nombreSucursal}</dd></div><div><dt>Ubicación</dt><dd>{config.data.zona}</dd></div><div><dt>Horario</dt><dd>{config.data.horaApertura} a {config.data.horaCierre}</dd></div><div><dt>Tamaño</dt><dd>{{ PEQUENA: 'Pequeña', MEDIANA: 'Mediana', GRANDE: 'Grande' }[config.data.tamano]}</dd></div></dl></section>
      <section className="panel settings-card"><SectionHeadingIcon icon="sparkles" title="Asistencia inteligente" /><p className="settings-guidance">Ayuda a estimar ventas y preparar tus pedidos. Tú decides qué promociones activar.</p><div className="stack-form settings-provider"><label>Proveedor de asistencia<select value={config.data.proveedorIA} disabled={!online || mutation.isPending} onChange={event => { const value = Number(event.target.value) as Schema['CambioIA']['proveedorIA']; if (value !== config.data.proveedorIA) { mutation.reset(); setNotice(''); setSelection(value) } }}>{iaProviders.map(provider => <option value={provider.value} key={provider.value}>{provider.label}</option>)}</select></label></div></section>
      <section className="panel settings-card limits-card"><SectionHeadingIcon icon="shield" title="Límites de promociones" /><div className="limit-grid"><div><strong>{config.data.descuentoMaximo}%</strong><span>Descuento máximo permitido</span></div><div><strong>{config.data.margenMinimoPromo}%</strong><span>Margen mínimo sobre el costo</span></div></div><p>El margen mínimo indica cuánto debe quedar por encima del costo del producto.</p></section>
    </div>}
    {selection !== null && config.data && <Modal title={selection === 0 ? '¿Desactivar la asistencia inteligente?' : `¿Usar ${iaProviders.find(provider => provider.value === selection)?.label} para la asistencia?`} description={selection === 0 ? 'Las próximas recomendaciones usarán cálculos básicos. Las promociones que ya activaste no cambian.' : 'Cambiará el proveedor seleccionado para las próximas recomendaciones. Tú seguirás decidiendo qué promociones activar.'} onClose={() => setSelection(null)} busy={mutation.isPending}>{mutation.isError && <Notice error message={mutation.error.message} />}<div className="modal-actions"><button className="button outlined" disabled={mutation.isPending} onClick={() => setSelection(null)}>Cancelar</button><button className="button primary" disabled={!online || mutation.isPending} onClick={() => mutation.mutate(selection)}>{mutation.isPending ? 'Guardando…' : 'Confirmar cambio'}</button></div></Modal>}
  </>
}
function SectionHeadingIcon({ title, icon }: { title: string; icon: 'store' | 'sparkles' | 'shield' }) { const Icon = icon === 'store' ? Store : icon === 'sparkles' ? Sparkles : ShieldCheck; return <div className="settings-heading"><span className="summary-icon blue"><Icon size={21} aria-hidden="true" /></span><h2>{title}</h2></div> }

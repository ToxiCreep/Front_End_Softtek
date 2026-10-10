import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Sparkles, Store } from 'lucide-react'
import { api } from '../api'
import type { Schema } from '../api'
import { ErrorState, Loading, Modal, Notice, PageTitle, useOnline } from '../ui'

export default function Settings() {
  const client = useQueryClient()
  const online = useOnline()
  const [confirm, setConfirm] = useState(false)
  const [notice, setNotice] = useState('')
  const config = useQuery({ queryKey: ['configuracion'], queryFn: () => api<Schema['Configuracion']>('/configuracion') })
  const mutation = useMutation({ mutationFn: () => api<Schema['Configuracion']>('/configuracion/ia', { method: 'PATCH', body: JSON.stringify({ iaHabilitada: !config.data!.iaHabilitada }) }), onSuccess: data => { client.setQueryData(['configuracion'], data); client.invalidateQueries({ queryKey: ['reabasto'] }); setConfirm(false); setNotice(data.iaHabilitada ? 'Asistencia inteligente activada.' : 'Asistencia inteligente desactivada. Puedes seguir usando las recomendaciones básicas.') } })
  return <><PageTitle title="Ajustes" />{notice && <Notice message={notice} />}
    {config.isPending ? <Loading /> : config.isError ? <ErrorState error={config.error} retry={() => config.refetch()} /> : <div className="settings-grid"><section className="panel settings-card"><SectionHeadingIcon icon="store" title="Sucursal" /><dl className="settings-facts"><div><dt>Nombre</dt><dd>{config.data.nombreSucursal}</dd></div><div><dt>Ubicación</dt><dd>{config.data.zona}</dd></div><div><dt>Horario</dt><dd>{config.data.horaApertura} a {config.data.horaCierre}</dd></div><div><dt>Tamaño</dt><dd>{{ PEQUENA: 'Pequeña', MEDIANA: 'Mediana', GRANDE: 'Grande' }[config.data.tamano]}</dd></div></dl></section>
      <section className="panel settings-card"><SectionHeadingIcon icon="sparkles" title="Asistencia inteligente" /><p className="settings-guidance">Ayuda a estimar ventas y preparar tus pedidos. Tú decides qué promociones activar.</p><div className="switch-row"><div><strong>Usar inteligencia artificial</strong><span>{config.data.iaHabilitada ? 'Activada' : 'Desactivada'}</span></div><button className="switch" role="switch" aria-label="Usar inteligencia artificial" aria-checked={config.data.iaHabilitada} disabled={!online || mutation.isPending} onClick={() => { mutation.reset(); setConfirm(true) }}><span /></button></div></section>
      <section className="panel settings-card limits-card"><SectionHeadingIcon icon="shield" title="Límites de promociones" /><div className="limit-grid"><div><strong>{config.data.descuentoMaximo}%</strong><span>Descuento máximo permitido</span></div><div><strong>{config.data.margenMinimoPromo}%</strong><span>Margen mínimo sobre el costo</span></div></div><p>El margen mínimo indica cuánto debe quedar por encima del costo del producto.</p></section>
    </div>}
    {confirm && config.data && <Modal title={config.data.iaHabilitada ? '¿Desactivar la asistencia inteligente?' : '¿Activar la asistencia inteligente?'} description={config.data.iaHabilitada ? 'Las próximas recomendaciones usarán cálculos básicos. Las promociones que ya activaste no cambian.' : 'Las próximas recomendaciones podrán usar inteligencia artificial. Tú seguirás decidiendo qué promociones activar.'} onClose={() => setConfirm(false)} busy={mutation.isPending}>{mutation.isError && <Notice error message={mutation.error.message} />}<div className="modal-actions"><button className="button outlined" disabled={mutation.isPending} onClick={() => setConfirm(false)}>Cancelar</button><button className="button primary" disabled={!online || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Guardando…' : config.data.iaHabilitada ? 'Sí, desactivar' : 'Sí, activar'}</button></div></Modal>}
  </>
}
function SectionHeadingIcon({ title, icon }: { title: string; icon: 'store' | 'sparkles' | 'shield' }) { const Icon = icon === 'store' ? Store : icon === 'sparkles' ? Sparkles : ShieldCheck; return <div className="settings-heading"><span className="summary-icon blue"><Icon size={21} aria-hidden="true" /></span><h2>{title}</h2></div> }

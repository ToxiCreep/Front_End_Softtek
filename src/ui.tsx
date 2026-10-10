import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, ArrowRight, Check, CheckCircle2, ChevronRight, LoaderCircle, X } from 'lucide-react'
import { Link } from 'react-router'
import { exactMoney, money, quantity, shortDate } from './api'

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return online
}

export function PageTitle({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className="page-title"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{children && <div className="page-actions">{children}</div>}</div>
}
export function Loading() { return <div className="loading" role="status"><LoaderCircle className="spin" aria-hidden="true" />Preparando tu información…</div> }
export function ErrorState({ error, retry }: { error: Error | null; retry: () => unknown }) {
  return <div className="error-state" role="alert"><AlertCircle aria-hidden="true" /><h2>No pudimos cargar la información</h2><p>{error?.message || 'Intenta de nuevo en un momento.'}</p><button className="button primary" onClick={retry}>Volver a intentar</button></div>
}
export function Notice({ message, error = false }: { message: string; error?: boolean }) {
  return <div className={`notice ${error ? 'danger' : ''}`} role={error ? 'alert' : 'status'}>{error ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}<span>{message}</span></div>
}
export function Empty({ title, description }: { title: string; description: string }) {
  return <div className="empty"><CheckCircle2 aria-hidden="true" /><h3>{title}</h3><p>{description}</p></div>
}
export const statusLabels: Record<string, string> = { NORMAL: 'Existencias suficientes', BAJO_STOCK: 'Quedan pocas unidades', AGOTADO: 'Sin existencias', SOBRESTOCK: 'Hay unidades de más', SUGERIDA: 'Por revisar', ACTIVA: 'Activa', RECHAZADA: 'Descartada', FINALIZADA: 'Finalizada' }
export function Status({ value }: { value: string }) {
  return <span className={`status status-${value.toLowerCase()}`}>{['NORMAL', 'ACTIVA', 'FINALIZADA'].includes(value) ? <Check size={13} aria-hidden="true" /> : <span className="status-dot" aria-hidden="true" />}{statusLabels[value] || value}</span>
}
export function TextLink({ to, children }: { to: string; children: ReactNode }) { return <Link className="text-link" to={to}>{children}<ArrowRight size={17} aria-hidden="true" /></Link> }
export function SectionHeading({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</div>
}
export function Modal({ title, description, children, onClose, busy = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef(document.activeElement as HTMLElement | null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close(); if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); else document.getElementById('main-content')?.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className="modal" aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="modal-heading"><div><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" aria-label="Cerrar" onClick={onClose} disabled={busy}><X aria-hidden="true" /></button></div>
    {children}
  </dialog>
}

export const chartColors = ['var(--chart-blue)', 'var(--chart-green)', 'var(--chart-amber)', 'var(--chart-red)']
export type Series = { label: string; color: string; values: (number | null)[] }
export function Chart({ dates, series, currency = false, description }: { dates: string[]; series: Series[]; currency?: boolean; description: string }) {
  const values = series.flatMap(s => s.values.filter((value): value is number => value !== null && Number.isFinite(value)))
  const min = Math.min(0, ...values) * 1.2
  const max = Math.max(1, ...values) * 1.2
  const x = (index: number) => 84 + index / Math.max(1, dates.length - 1) * 600
  const y = (value: number) => 210 - (value - min) / (max - min) * 166
  const id = useId().replace(/:/g, '')
  return <div className="chart-wrap">
    <div className="chart-legend">{series.map((s, i) => <span key={s.label}><span style={{ background: s.color }} className={`legend-marker ${i ? 'secondary-marker' : ''}`} />{s.label}</span>)}</div>
    <div className="chart-plot"><svg className="chart" viewBox="0 0 720 260" role="img" aria-label={description}>
      <defs><linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={series[0]?.color} stopOpacity=".28" /><stop offset="1" stopColor={series[0]?.color} stopOpacity=".02" /></linearGradient></defs>
      {[0, 1, 2, 3].map(i => { const value = min + (max - min) * i / 3; return <g key={i}><line x1="84" y1={y(value)} x2="686" y2={y(value)} stroke="var(--border)" strokeDasharray="3 5" /><text x="70" y={y(value) + 4} textAnchor="end" fill="var(--muted)" fontSize="12">{currency ? money(value) : Math.round(value)}</text></g> })}
      {min < 0 && <line x1="84" x2="686" y1={y(0)} y2={y(0)} stroke="var(--muted)" />}
      {series.map((s, si) => {
        const points = dates.map((_, i) => s.values[i] == null || !Number.isFinite(s.values[i]) ? null : { x: x(i), y: y(s.values[i]!) })
        let path = ''
        let gap = true
        points.forEach(point => { if (!point) gap = true; else { path += `${gap ? 'M' : 'L'}${point.x},${point.y} `; gap = false } })
        return <g key={s.label}>{si === 0 && points.length > 1 && points.every(Boolean) && <path d={`${path}L${x(dates.length - 1)},${y(0)} L84,${y(0)} Z`} fill={`url(#gradient-${id})`} />}
          <path d={path} fill="none" stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={si ? '6 4' : undefined} />
          {points.map((p, i) => p && <circle key={i} cx={p.x} cy={p.y} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2"><title>{shortDate(dates[i])}: {s.label}, {currency ? exactMoney(s.values[i]!) : quantity(s.values[i]!)}</title></circle>)}
        </g>
      })}
      {dates.map((d, i) => (i === 0 || i === dates.length - 1 || i % Math.ceil(dates.length / 7) === 0) && <text key={d} x={x(i)} y="242" textAnchor="middle" fontSize="14" fill="var(--muted)">{shortDate(d)}</text>)}
    </svg></div>
    <details className="chart-table"><summary><ChevronRight size={16} aria-hidden="true" />Ver los números de la gráfica</summary><div className="table-scroll"><table><caption className="sr-only">{description}</caption><thead><tr><th>Fecha</th>{series.map(s => <th key={s.label}>{s.label}</th>)}</tr></thead><tbody>{dates.map((date, i) => <tr key={date}><td>{shortDate(date)}</td>{series.map(s => <td key={s.label}>{s.values[i] == null ? 'Sin dato' : currency ? exactMoney(s.values[i]!) : quantity(s.values[i]!)}</td>)}</tr>)}</tbody></table></div></details>
  </div>
}

export function BarChart({ labels, series, currency = false, unit = '', description }: { labels: string[]; series: Series[]; currency?: boolean; unit?: string; description: string }) {
  const values = series.flatMap(s => s.values.filter((v): v is number => v !== null && Number.isFinite(v)))
  const min = Math.min(0, ...values), max = Math.max(0, ...values)
  const range = max - min || 1
  const position = (value: number) => (value - min) / range * 100
  return <div className="bar-chart">
    {series.length > 1 && <div className="chart-legend">{series.map(s => <span key={s.label}><span className="legend-marker" style={{ background: s.color }} />{s.label}</span>)}</div>}
    <ol className="bar-chart-list" aria-label={description}>{labels.map((label, i) => <li key={`${label}-${i}`}><strong className="bar-category">{label}</strong><div className="bar-series">{series.map(s => {
      const value = s.values[i], known = value != null && Number.isFinite(value)
      const color = series.length === 1 ? chartColors[i % chartColors.length] : s.color
      return <div className="bar-row" key={s.label}><span className="sr-only">{s.label}: </span><div className="bar-track" aria-hidden="true"><span className="bar-zero" style={{ left: `${position(0)}%` }} />{known && <span className="bar-fill" style={{ left: `${Math.min(position(0), position(value))}%`, width: `${Math.abs(value) / range * 100}%`, background: color }} />}</div><span className="bar-value" style={{ color }}>{known ? currency ? exactMoney(value) : `${quantity(value)}${unit ? ` ${unit}` : ''}` : 'Sin dato'}</span></div>
    })}</div></li>)}</ol>
  </div>
}

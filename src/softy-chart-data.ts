import { isRecord } from '../vendor/maya-portable/src/core/protocol.js'

type ChartSeries = { label: string; values: (number | null)[] }
const label = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 160
const number = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value))

/** La geometría y los colores pertenecen a la app; el modelo solo entrega datos. */
export function readSoftyChart(type: string, props: Record<string, unknown>) {
  let labels = props.labels, series = props.series
  if (type === 'BarChart' && Array.isArray(props.bars)) {
    if (!props.bars.every(isRecord)) return null
    labels = props.bars.map(bar => bar.label)
    series = [{ label: 'Valor', values: props.bars.map(bar => bar.value) }]
  }
  if (type === 'LineChart') labels = props.dates
  if (!Array.isArray(labels) || !labels.length || labels.length > 31 || !labels.every(label)) return null
  if (type === 'LineChart' && (new Set(labels).size !== labels.length || labels.some((date, i) => !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || (i > 0 && date < labels[i - 1])))) return null
  if (!Array.isArray(series) || !series.length || series.length > 4 || !series.every(s => isRecord(s) && label(s.label) && Array.isArray(s.values) && s.values.length === labels.length && s.values.every(number))) return null
  if (new Set(series.map(s => s.label)).size !== series.length) return null
  const unit = typeof props.unit === 'string' && props.unit.length <= 40 ? props.unit : ''
  return { labels: labels as string[], series: series as ChartSeries[], title: typeof props.title === 'string' ? props.title.slice(0, 200) : '', currency: props.currency === true || /^(MXN|pesos|pesos mexicanos|\$)$/i.test(unit), unit }
}

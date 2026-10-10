import type { ComponentRendererProps } from '../vendor/maya-portable/src/react/A2UIRenderer.js'
import { BarChart, Chart, chartColors, Empty, Notice } from './ui'
import { readSoftyChart } from './softy-chart-data'

export function SoftyChart({ component }: ComponentRendererProps) {
  const data = readSoftyChart(component.type, component.props)
  if (!data) return <Notice error message="No pudimos mostrar esta gráfica. Pide a Softy que vuelva a consultarla." />
  const series = data.series.map((s, i) => ({ ...s, color: chartColors[i % chartColors.length] }))
  return <section className="maya-chart softy-chart">{data.title && <h3>{data.title}</h3>}
    {series.every(s => s.values.every(v => v === null)) ? <Empty title="Sin datos para esta gráfica" description="Prueba otro periodo o producto." /> : component.type === 'LineChart' ? <Chart dates={data.labels} series={series} currency={data.currency} description={data.title || 'Evolución de los datos de tu sucursal por fecha.'} /> : <BarChart labels={data.labels} series={series} currency={data.currency} unit={data.unit} description={data.title || 'Comparación de los datos de tu sucursal.'} />}
  </section>
}

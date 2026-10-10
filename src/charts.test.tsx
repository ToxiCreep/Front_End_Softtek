// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { BarChart, Chart } from './ui'
import { readSoftyChart } from './softy-chart-data'
import { SoftyChart } from './SoftyCharts'

afterEach(cleanup)

it('conserva pérdidas, cero y datos ausentes sin barras negativas ni NaN', () => {
  const { container } = render(<BarChart labels={['Pérdida', 'Cero', 'Sin información']} series={[{ label: 'Margen', color: 'blue', values: [-20, 0, null] }]} currency description="Ganancia por producto" />)
  expect(screen.getByText('Sin dato')).toBeTruthy()
  const fills = [...container.querySelectorAll<HTMLElement>('.bar-fill')]
  expect(fills).toHaveLength(2)
  expect(fills.map(e => e.style.width)).toEqual(['100%', '0%'])
  expect(fills[0].style.left).toBe('0%')
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
})

it('deja huecos en la tendencia y permite ganancia negativa', () => {
  const { container } = render(<Chart dates={['2026-10-01', '2026-10-02', '2026-10-03']} series={[{ label: 'Ganancia', color: 'green', values: [-10, null, 20] }]} currency description="Ganancia por día" />)
  const line = container.querySelector('path[stroke="green"]')!
  expect(line.getAttribute('d')?.match(/M/g)).toHaveLength(2)
  expect(container.querySelectorAll('circle')).toHaveLength(2)
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  expect(screen.getByText('Sin dato')).toBeTruthy()
})

it('conserva las gráficas antiguas de Softy y aplica la paleta del anfitrión', () => {
  const { container } = render(<SoftyChart component={{ id: 'legacy', type: 'BarChart', props: { title: 'Ventas', unit: 'MXN', bars: [{ label: 'Leche', value: 12, color: 'url(https://externo)' }] } }} loading={false} onAction={() => {}} />)
  expect(container.querySelector<HTMLElement>('.bar-fill')?.style.background).toBe('var(--chart-blue)')
  expect(container.innerHTML).not.toContain('externo')
})

it('valida fechas, longitudes, valores y límites de las gráficas recibidas del modelo', () => {
  const valid = { dates: ['2026-10-01', '2026-10-02'], series: [{ label: 'Ingresos', values: [0, null] }], currency: true }
  expect(readSoftyChart('LineChart', valid)?.series[0].values).toEqual([0, null])
  expect(readSoftyChart('LineChart', { ...valid, dates: ['2026-02-30', '2026-10-02'] })).toBeNull()
  expect(readSoftyChart('LineChart', { ...valid, dates: [...valid.dates].reverse() })).toBeNull()
  expect(readSoftyChart('LineChart', { ...valid, series: [{ label: 'Ingresos', values: [5] }] })).toBeNull()
  expect(readSoftyChart('LineChart', { ...valid, series: [{ label: 'Ingresos', values: [5, 'sin dato'] }] })).toBeNull()
  expect(readSoftyChart('BarChart', { bars: Array(32).fill({ label: 'Producto', value: 1 }) })).toBeNull()
})

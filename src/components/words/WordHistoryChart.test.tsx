import { render } from '@testing-library/react'
import * as Highcharts from 'highcharts'
import { describe, expect, it } from 'vitest'
import type { Attempt } from '../../lib/types'
import WordHistoryChart from './WordHistoryChart'

/** A local wall-clock attempt, so the AM/PM split does not depend on the zone. */
const at = (day: number, hour: number, correct: boolean): Attempt => ({
  t: new Date(2026, 8, day, hour, 0).getTime(),
  correct,
})

// Sep 2 AM: 1 of 2 correct. Sep 2 PM: 2 of 3 correct, so 3 of 5 cumulative.
const attempts: Attempt[] = [
  at(2, 9, true),
  at(2, 10, false),
  at(2, 13, true),
  at(2, 14, false),
  at(2, 20, true),
]

/** The chart created by the component just rendered. */
function lastChart(): Highcharts.Chart {
  const live = Highcharts.charts.filter((chart): chart is Highcharts.Chart => Boolean(chart))
  const chart = live[live.length - 1]
  if (!chart) throw new Error('no Highcharts chart was created')
  return chart
}

describe('WordHistoryChart', () => {
  it('renders nothing before the word has been practised', () => {
    const { container } = render(<WordHistoryChart attempts={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('plots per-period accuracy against the cumulative line', () => {
    render(<WordHistoryChart attempts={attempts} />)
    const chart = lastChart()

    expect(chart.series.map((series) => series.name)).toEqual([
      'Correct in period',
      'Cumulative accuracy',
    ])
    expect(chart.series.map((series) => series.type)).toEqual(['column', 'line'])
    expect(chart.xAxis[0].categories).toEqual(['Sep 2 2026 AM', 'Sep 2 2026 PM'])
    expect(chart.series[0].points.map((point) => point.y)).toEqual([50, (2 / 3) * 100])
    expect(chart.series[1].points.map((point) => point.y)).toEqual([50, 60])
    // One axis, 0–100 with percentage labels.
    expect(chart.yAxis).toHaveLength(1)
    expect([chart.yAxis[0].min, chart.yAxis[0].max]).toEqual([0, 100])
    expect(chart.yAxis[0].options.labels?.format).toBe('{value}%')
    expect(chart.options.legend?.enabled).not.toBe(false)
    expect(chart.options.credits?.enabled).toBe(false)
  })

  it('labels each column with its score', () => {
    const { container } = render(<WordHistoryChart attempts={attempts} />)
    const points = lastChart().series[0].points
    expect(points.map((point) => point.options.custom?.score)).toEqual(['1/2', '2/3'])

    const labels = [...container.querySelectorAll('.highcharts-data-labels text')]
    expect(labels.map((label) => label.textContent)).toEqual(['1/2', '2/3'])
  })

  it('describes the whole period in one shared tooltip', () => {
    render(<WordHistoryChart attempts={attempts} />)
    const chart = lastChart()
    expect(chart.options.tooltip?.shared).toBe(true)

    const formatter = chart.options.tooltip?.formatter
    const context = { index: 1 } as unknown as Highcharts.Point
    expect(formatter?.call(context, chart.tooltip)).toBe(
      'Sep 2 2026 PM · 2 of 3 correct · cumulative 60%',
    )
  })

  it('tilts the category labels once there are more than six periods', () => {
    const many = Array.from({ length: 8 }, (_, i) => at(1 + i, 9, true))
    render(<WordHistoryChart attempts={[at(1, 9, true)]} />)
    expect(lastChart().xAxis[0].options.labels?.rotation).toBe(0)

    render(<WordHistoryChart attempts={many} />)
    const chart = lastChart()
    expect(chart.xAxis[0].categories).toHaveLength(8)
    expect(chart.xAxis[0].options.labels?.rotation).toBe(-45)
  })
})

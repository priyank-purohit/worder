import { render, screen } from '@testing-library/react'
import * as Highcharts from 'highcharts'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { HardWord } from '../../lib/stats'
import type { WordRow } from '../../lib/types'
import AccuracyByPresentationChart from './AccuracyByPresentationChart'
import AttemptsPerDayChart from './AttemptsPerDayChart'
import HardestWordsTable from './HardestWordsTable'
import StatTiles from './StatTiles'
import { dayToLocalMs, ordinal } from '../chartOptions'

const LANGUAGES = ['English', 'French', 'Gujarati']

const hard = (key: string, seen: number, correct: number): HardWord => ({
  key,
  seen,
  correct,
  incorrect: seen - correct,
  pctCorrect: (correct / seen) * 100,
})

describe('ordinal', () => {
  it('labels presentation numbers', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '101st',
    ])
  })
})

describe('dayToLocalMs', () => {
  it('maps a calendar day to its local midnight', () => {
    expect(dayToLocalMs('2026-03-09')).toBe(new Date(2026, 2, 9).getTime())
    const local = new Date(dayToLocalMs('2026-01-01'))
    expect([local.getFullYear(), local.getMonth(), local.getDate()]).toEqual([2026, 0, 1])
    expect([local.getHours(), local.getMinutes()]).toEqual([0, 0])
  })
})

describe('highcharts global setup', () => {
  it('renders dates in the browser zone, not UTC', () => {
    expect(Highcharts.getOptions().time?.timezone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
    expect(Highcharts.getOptions().lang?.thousandsSep).toBe(',')
  })
})

describe('StatTiles', () => {
  it('shows each value with its caption', () => {
    render(
      <StatTiles
        tiles={[
          { label: 'Words seen', value: '12 / 400' },
          { label: 'Attempts', value: '57' },
        ]}
      />,
    )
    expect(screen.getByText('12 / 400')).toBeInTheDocument()
    expect(screen.getByText('Words seen')).toBeInTheDocument()
    expect(screen.getByText('57')).toBeInTheDocument()
  })
})

describe('HardestWordsTable', () => {
  const rowsByKey = new Map<string, WordRow>([
    ['manger::to eat', { index: 4, texts: { English: 'to eat', French: 'manger', Gujarati: 'ખાવું' } }],
  ])

  it('links each word to its detail page and shows its stats', () => {
    render(
      <MemoryRouter>
        <HardestWordsTable
          words={[hard('manger::to eat', 4, 1)]}
          rowsByKey={rowsByKey}
          presLang="French"
          languages={LANGUAGES}
        />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'manger' })
    expect(link).toHaveAttribute('href', `/words/${encodeURIComponent('manger::to eat')}`)
    expect(screen.getByText('to eat / ખાવું')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('falls back to the key when the word file no longer has the row', () => {
    render(
      <MemoryRouter>
        <HardestWordsTable
          words={[hard('vieux::old', 3, 0)]}
          rowsByKey={rowsByKey}
          presLang="French"
          languages={LANGUAGES}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'vieux' })).toBeInTheDocument()
    expect(screen.getByText('old')).toBeInTheDocument()
  })

  it('explains the threshold when nothing qualifies', () => {
    render(
      <MemoryRouter>
        <HardestWordsTable words={[]} rowsByKey={rowsByKey} presLang="French" languages={LANGUAGES} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Words appear here after 3+ attempts.')).toBeInTheDocument()
  })
})

/** The chart created by the component just rendered. */
function lastChart(): Highcharts.Chart {
  const live = Highcharts.charts.filter((chart): chart is Highcharts.Chart => Boolean(chart))
  const chart = live[live.length - 1]
  if (!chart) throw new Error('no Highcharts chart was created')
  return chart
}

describe('AccuracyByPresentationChart', () => {
  const data = [
    { n: 1, pct: 50.4, count: 10 },
    { n: 2, pct: 70, count: 6 },
  ]

  it('draws one column per presentation number, labelled with ordinals', () => {
    const { container } = render(<AccuracyByPresentationChart data={data} />)
    expect(container.querySelector('svg.highcharts-root')).toBeInTheDocument()

    const chart = lastChart()
    expect(chart.series[0].type).toBe('column')
    expect(chart.series[0].points.map((point) => point.y)).toEqual([50.4, 70])
    expect(chart.xAxis[0].categories).toEqual(['1st', '2nd'])
    // The percentage axis must really stop at 100: a second y axis makes
    // Highcharts align tick counts and overshoot unless that is turned off.
    expect(chart.yAxis[0].max).toBe(100)
    // (jsdom gives the chart no height, so the tick count itself is not fixed.)
    expect(chart.yAxis[0].tickPositions?.at(-1)).toBe(100)
    expect(chart.options.credits?.enabled).toBe(false)
  })

  it('puts the sample size in the tooltip', () => {
    render(<AccuracyByPresentationChart data={data} />)
    const point = lastChart().series[0].points[0]
    const options = point.series.options as Highcharts.SeriesColumnOptions
    expect(Highcharts.format(options.tooltip?.pointFormat ?? '', { point })).toBe(
      '<b>50%</b> correct · n = 10',
    )
  })
})

describe('AttemptsPerDayChart', () => {
  it('stacks correct and incorrect columns on a datetime axis', () => {
    render(
      <AttemptsPerDayChart
        data={[
          { day: '2026-03-01', correct: 3, incorrect: 1 },
          { day: '2026-03-02', correct: 5, incorrect: 0 },
        ]}
      />,
    )
    const chart = lastChart()
    expect(chart.xAxis[0].options.type).toBe('datetime')
    expect(chart.series.map((series) => series.name)).toEqual(['Correct', 'Incorrect'])
    expect((chart.series[0].options as Highcharts.SeriesColumnOptions).stacking).toBe('normal')
    // Local midnight, and the axis labels it as that same local day.
    expect(chart.series[0].points[0].x).toBe(new Date(2026, 2, 1).getTime())
    expect(chart.time.dateFormat('%Y-%m-%d', chart.series[0].points[0].x)).toBe('2026-03-01')
    expect(chart.time.dateFormat('%Y-%m-%d', chart.series[0].points[1].x)).toBe('2026-03-02')
    expect(chart.series[1].points.map((point) => point.y)).toEqual([1, 0])
  })
})

describe('chart empty states', () => {
  it('replaces both charts with a message when there is no data', () => {
    render(
      <>
        <AccuracyByPresentationChart data={[]} />
        <AttemptsPerDayChart data={[]} />
      </>,
    )
    expect(screen.getByText(/practise a few words/i)).toBeInTheDocument()
    expect(screen.getByText(/daily practice/i)).toBeInTheDocument()
  })
})

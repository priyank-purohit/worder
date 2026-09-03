import { render, screen } from '@testing-library/react'
import * as Highcharts from 'highcharts'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { HardWord } from '../../lib/stats'
import type { WordRow } from '../../lib/types'
import { CORRECT_COLOR } from '../../theme'
import AccuracyByPresentationChart from './AccuracyByPresentationChart'
import AttemptsPerDayChart from './AttemptsPerDayChart'
import HardestWordsTable from './HardestWordsTable'
import StatTiles from './StatTiles'
import WordsPerPresentationChart from './WordsPerPresentationChart'
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

/**
 * The CSS rules emotion emitted for `element`'s own generated class, media
 * queries included, with spaces stripped so they can be matched literally.
 */
function rulesFor(element: Element): string[] {
  const own = [...element.classList].find((name) => name.startsWith('css-'))
  if (own === undefined) return []
  return [...document.querySelectorAll('style')]
    .map((tag) => (tag.textContent ?? '').replace(/\s+/g, ''))
    .filter((text) => text.includes(`.${own}{`))
}

describe('StatTiles', () => {
  const tiles = [
    { id: 'words-seen', label: 'Words seen', value: '12 / 400' },
    { id: 'attempts', label: 'Attempts', value: '57' },
  ]

  it('shows each value with its caption', () => {
    render(<StatTiles tiles={tiles} />)
    expect(screen.getByText('12 / 400')).toBeInTheDocument()
    expect(screen.getByText('Words seen')).toBeInTheDocument()
    expect(screen.getByText('57')).toBeInTheDocument()
  })

  it('gives each tile a stable test id', () => {
    render(<StatTiles tiles={tiles} />)
    expect(screen.getByTestId('tile-words-seen')).toHaveTextContent('12 / 400')
    expect(screen.getByTestId('tile-attempts')).toHaveTextContent('57')
  })

  it('lays the tiles out as one grid: two columns on phones, four on desktop', () => {
    render(<StatTiles tiles={tiles} />)
    // A CSS grid, not MUI `Grid`: the `Grid` row's compensating negative
    // margin was stripped by the `Stack` on DashboardPage, which left the row
    // 16px wider than the page and offset from the section headings.
    const grid = screen.getByTestId('stat-tiles')
    expect(grid).toHaveStyle({ display: 'grid', gap: '12px', alignItems: 'stretch' })
    // Every tile is a direct child, so the grid — not a wrapper — sizes them.
    expect(tiles.map(({ id }) => screen.getByTestId(`tile-${id}`).parentElement)).toEqual([
      grid,
      grid,
    ])
    // jsdom computes no value for `grid-template-columns`, so the breakpoints
    // are read off the rules emotion emitted for this element.
    const rules = rulesFor(grid)
    expect(rules.some((rule) => rule.includes('grid-template-columns:repeat(2,minmax(0,1fr))'))).toBe(
      true,
    )
    expect(
      rules.some(
        (rule) =>
          rule.includes('(min-width:900px)') &&
          rule.includes('grid-template-columns:repeat(4,minmax(0,1fr))'),
      ),
    ).toBe(true)
  })

  it('keeps every value on one line so the tiles stay the same height', () => {
    render(<StatTiles tiles={tiles} />)
    for (const tile of ['tile-words-seen', 'tile-attempts']) {
      const paper = screen.getByTestId(tile)
      const value = paper.querySelector('p')
      const caption = paper.querySelector('span')
      expect(getComputedStyle(value as Element).whiteSpace).toBe('nowrap')
      expect(getComputedStyle(caption as Element).textOverflow).toBe('ellipsis')
      expect(paper).toHaveStyle({ height: '100%', minWidth: '0px' })
    }
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

const byPresentation = [
  { n: 1, pct: 50.4, count: 120 },
  { n: 2, pct: 61, count: 78 },
  { n: 3, pct: 72, count: 41 },
]

describe('AccuracyByPresentationChart', () => {
  it('draws one accuracy column per presentation number, labelled with ordinals', () => {
    const { container } = render(<AccuracyByPresentationChart data={byPresentation} />)
    expect(container.querySelector('svg.highcharts-root')).toBeInTheDocument()

    const chart = lastChart()
    // A single series: the word counts live in their own chart now.
    expect(chart.series).toHaveLength(1)
    expect(chart.series[0].type).toBe('column')
    expect(chart.series[0].points.map((point) => point.y)).toEqual([50.4, 61, 72])
    expect(chart.xAxis[0].categories).toEqual(['1st', '2nd', '3rd'])
    expect(chart.yAxis).toHaveLength(1)
    expect(chart.yAxis[0].max).toBe(100)
    // (jsdom gives the chart no height, so the tick count itself is not fixed.)
    expect(chart.yAxis[0].tickPositions?.at(-1)).toBe(100)
    expect(chart.options.credits?.enabled).toBe(false)
  })

  it('spells out the presentation and the sample size in the tooltip', () => {
    render(<AccuracyByPresentationChart data={byPresentation} />)
    const point = lastChart().series[0].points[2]
    const options = point.series.options as Highcharts.SeriesColumnOptions
    expect(Highcharts.format(options.tooltip?.pointFormat ?? '', { point })).toBe(
      '<b>72%</b> correct on the 3rd presentation (n = 41)',
    )
  })
})

describe('WordsPerPresentationChart', () => {
  it('draws one neutral column of word counts on the same categories', () => {
    render(<WordsPerPresentationChart data={byPresentation} />)

    const chart = lastChart()
    expect(chart.series).toHaveLength(1)
    expect(chart.series[0].type).toBe('column')
    expect(chart.series[0].points.map((point) => point.y)).toEqual([120, 78, 41])
    expect(chart.xAxis[0].categories).toEqual(['1st', '2nd', '3rd'])
    expect(chart.yAxis[0].options.allowDecimals).toBe(false)
    expect(chart.series[0].color).not.toBe(CORRECT_COLOR)
  })

  it('reads as a sentence in the tooltip', () => {
    render(<WordsPerPresentationChart data={byPresentation} />)
    const points = lastChart().series[0].points
    const format = (point: Highcharts.Point) =>
      Highcharts.format(
        (point.series.options as Highcharts.SeriesColumnOptions).tooltip?.pointFormat ?? '',
        { point },
      )
    expect(format(points[2])).toBe('41 words have been shown 3 times')
    expect(format(points[0])).toBe('120 words have been shown once')
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
  it('replaces every chart with a message when there is no data', () => {
    render(
      <>
        <AccuracyByPresentationChart data={[]} />
        <WordsPerPresentationChart data={[]} />
        <AttemptsPerDayChart data={[]} />
      </>,
    )
    expect(screen.getByText(/practise a few words to see this chart/i)).toBeInTheDocument()
    expect(screen.getByText(/how far they get/i)).toBeInTheDocument()
    expect(screen.getByText(/daily practice/i)).toBeInTheDocument()
  })
})

import { alpha, useTheme } from '@mui/material/styles'
import * as Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { useMemo } from 'react'
import { halfDayPeriods } from '../../lib/stats'
import type { Attempt } from '../../lib/types'
import { CORRECT_COLOR } from '../../theme'
import { axisTheme, baseChartOptions } from '../chartOptions'

/** Past this many categories the labels only fit tilted. */
const ROTATE_ABOVE = 6

/**
 * Accuracy per half-day (a local calendar day split at noon): one column for
 * the accuracy inside each period, plus a dashed line of the running accuracy.
 * Renders nothing until the word has been practised at least once.
 */
export default function WordHistoryChart({ attempts }: { attempts: Attempt[] }) {
  const theme = useTheme()

  const options = useMemo<Highcharts.Options>(() => {
    const base = baseChartOptions(theme)
    const axis = axisTheme(theme)
    const periods = halfDayPeriods(attempts)

    return {
      ...base,
      chart: { ...base.chart, type: 'column' },
      xAxis: {
        ...axis,
        type: 'category',
        categories: periods.map((period) => period.label),
        labels: {
          ...axis.labels,
          rotation: periods.length > ROTATE_ABOVE ? -45 : 0,
        },
      },
      yAxis: {
        ...axis,
        min: 0,
        max: 100,
        tickInterval: 25,
        title: { ...axis.title, text: undefined },
        labels: { ...axis.labels, format: '{value}%' },
      },
      tooltip: {
        ...base.tooltip,
        // One tooltip per category, whichever series is hovered — and both
        // series share an index, so either one identifies the period.
        shared: true,
        formatter(this: Highcharts.Point) {
          const period = periods[this.index]
          if (!period) return false
          const seen = period.correct + period.incorrect
          return [
            period.label,
            `${period.correct} of ${seen} correct`,
            `cumulative ${Math.round(period.cumulativePct)}%`,
          ].join(' · ')
        },
      },
      plotOptions: { column: { borderWidth: 0 }, series: { animation: false } },
      series: [
        {
          type: 'column',
          name: 'Correct in period',
          color: alpha(CORRECT_COLOR, 0.85),
          data: periods.map((period) => ({
            y: period.pct,
            custom: { score: `${period.correct}/${period.correct + period.incorrect}` },
          })),
          dataLabels: {
            enabled: true,
            format: '{point.custom.score}',
            color: theme.palette.text.secondary,
            // Sat on the card's own colour, so neither the cumulative line nor
            // a grid line can cut through the score where they cross it.
            backgroundColor: theme.palette.background.paper,
            borderWidth: 0,
            padding: 2,
            borderRadius: 2,
            style: { fontSize: '0.7rem', fontWeight: '400', textOutline: 'none' },
          },
        },
        {
          type: 'line',
          name: 'Cumulative accuracy',
          data: periods.map((period) => period.cumulativePct),
          color: theme.palette.text.secondary,
          dashStyle: 'Dash',
          lineWidth: 1,
          marker: { enabled: true, radius: 3, symbol: 'circle' },
        },
      ],
    }
  }, [attempts, theme])

  if (attempts.length === 0) return null

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
      containerProps={{ style: { width: '100%' } }}
    />
  )
}

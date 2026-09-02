import { useTheme } from '@mui/material/styles'
import * as Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { useMemo } from 'react'
import { runningAccuracy } from '../../lib/stats'
import type { Attempt } from '../../lib/types'
import { CORRECT_COLOR, INCORRECT_COLOR } from '../../theme'
import { axisTheme, baseChartOptions } from '../chartOptions'

/**
 * Running accuracy over time: a thin line, plus one green/red dot per attempt.
 * Renders nothing until the word has been practised at least once.
 */
export default function WordHistoryChart({ attempts }: { attempts: Attempt[] }) {
  const theme = useTheme()

  const options = useMemo<Highcharts.Options>(() => {
    const base = baseChartOptions(theme)
    const axis = axisTheme(theme)
    const points = runningAccuracy(attempts)
    const paper = theme.palette.background.paper

    return {
      ...base,
      chart: { ...base.chart, type: 'line' },
      legend: { enabled: false },
      xAxis: { ...axis, type: 'datetime' },
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
        formatter(this: Highcharts.Point) {
          // `chart.time` honours the zone set in `lib/highchartsSetup`.
          const when = this.series.chart.time.dateFormat('%e %b %Y, %H:%M', this.x)
          const custom = this.options.custom as { correct?: boolean } | undefined
          const correct = custom?.correct === true
          const color = correct ? CORRECT_COLOR : INCORRECT_COLOR
          return [
            `<b>${when}</b>`,
            `<span style="color:${color}">${correct ? 'Correct' : 'Incorrect'}</span>`,
            `Running accuracy: ${Math.round(this.y ?? 0)}%`,
          ].join('<br/>')
        },
      },
      plotOptions: { series: { animation: false } },
      series: [
        {
          type: 'line',
          name: 'Running accuracy',
          data: points.map((point): [number, number] => [point.t, point.pct]),
          color: theme.palette.text.secondary,
          lineWidth: 1,
          marker: { enabled: false },
          enableMouseTracking: false,
          states: { hover: { enabled: false }, inactive: { opacity: 1 } },
        },
        {
          type: 'scatter',
          name: 'Attempts',
          data: points.map((point) => ({
            x: point.t,
            y: point.pct,
            color: point.correct ? CORRECT_COLOR : INCORRECT_COLOR,
            custom: { correct: point.correct },
          })),
          marker: { radius: 6, symbol: 'circle', lineWidth: 1, lineColor: paper },
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

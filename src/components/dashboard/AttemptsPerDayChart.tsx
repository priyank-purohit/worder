import { useTheme } from '@mui/material/styles'
import * as Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { useMemo } from 'react'
import type { DayCount } from '../../lib/stats'
import { CORRECT_COLOR, INCORRECT_COLOR } from '../../theme'
import { axisTheme, baseChartOptions, dayToLocalMs } from '../chartOptions'
import EmptyState from './EmptyState'

/** One stacked column per day: correct on top of incorrect. */
export default function AttemptsPerDayChart({ data }: { data: DayCount[] }) {
  const theme = useTheme()

  const options = useMemo<Highcharts.Options>(() => {
    const base = baseChartOptions(theme)
    const axis = axisTheme(theme)
    const days = data.map((entry) => dayToLocalMs(entry.day))
    return {
      ...base,
      chart: { ...base.chart, type: 'column' },
      xAxis: {
        ...axis,
        type: 'datetime',
        // One tick per day at most; days with no practice stay empty.
        minTickInterval: 24 * 3600 * 1000,
      },
      yAxis: {
        ...axis,
        min: 0,
        allowDecimals: false,
        title: { ...axis.title, text: 'Attempts' },
      },
      plotOptions: {
        column: { stacking: 'normal', borderWidth: 0, pointPadding: 0.05, groupPadding: 0.1 },
        series: { animation: false },
      },
      tooltip: {
        ...base.tooltip,
        shared: true,
        xDateFormat: '%e %b %Y',
        pointFormat: '{series.name}: <b>{point.y}</b><br/>',
      },
      series: [
        {
          type: 'column',
          name: 'Correct',
          color: CORRECT_COLOR,
          data: data.map((entry, i) => [days[i], entry.correct]),
        },
        {
          type: 'column',
          name: 'Incorrect',
          color: INCORRECT_COLOR,
          data: data.map((entry, i) => [days[i], entry.incorrect]),
        },
      ],
    }
  }, [data, theme])

  if (data.length === 0) {
    return <EmptyState>No attempts yet — your daily practice will show up here.</EmptyState>
  }

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
      containerProps={{ style: { width: '100%' } }}
    />
  )
}

import { alpha, useTheme } from '@mui/material/styles'
import * as Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { useMemo } from 'react'
import type { PresentationAccuracy } from '../../lib/stats'
import { axisTheme, baseChartOptions, presentationAxis } from '../chartOptions'
import EmptyState from './EmptyState'

/** "shown once" / "shown 3 times" — the tail of the tooltip sentence. */
function timesShown(n: number): string {
  return n === 1 ? 'once' : `${n} times`
}

/**
 * The sample size behind the accuracy chart: how many words have ever reached
 * a 1st, 2nd, 3rd … presentation. Deliberately neutral in colour — it is
 * context for the green chart above it, not a second result.
 */
export default function WordsPerPresentationChart({ data }: { data: PresentationAccuracy[] }) {
  const theme = useTheme()

  const options = useMemo<Highcharts.Options>(() => {
    const base = baseChartOptions(theme)
    const axis = axisTheme(theme)
    return {
      ...base,
      chart: { ...base.chart, type: 'column' },
      legend: { enabled: false },
      xAxis: presentationAxis(theme, data.map((point) => point.n)),
      yAxis: {
        ...axis,
        min: 0,
        allowDecimals: false,
        title: { ...axis.title, text: 'Words' },
      },
      plotOptions: { column: { borderWidth: 0 }, series: { animation: false } },
      tooltip: { ...base.tooltip, headerFormat: '' },
      series: [
        {
          type: 'column',
          name: 'Words',
          color: alpha(theme.palette.text.secondary, 0.6),
          data: data.map((point) => ({
            y: point.count,
            custom: {
              subject: point.count === 1 ? 'word has' : 'words have',
              times: timesShown(point.n),
            },
          })),
          tooltip: {
            pointFormat: '{point.y} {point.custom.subject} been shown {point.custom.times}',
          },
        },
      ],
    }
  }, [data, theme])

  if (data.length < 1) {
    return <EmptyState>No attempts yet — practise a few words to see how far they get.</EmptyState>
  }

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
      containerProps={{ style: { width: '100%' } }}
    />
  )
}

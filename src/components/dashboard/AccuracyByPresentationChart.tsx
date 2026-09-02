import { useTheme } from '@mui/material/styles'
import * as Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { useMemo } from 'react'
import type { PresentationAccuracy } from '../../lib/stats'
import { CORRECT_COLOR } from '../../theme'
import { axisTheme, baseChartOptions, ordinal, presentationAxis } from '../chartOptions'
import EmptyState from './EmptyState'

/**
 * "How often do I get a word right the 1st / 2nd / 3rd time I see it?" —
 * accuracy per presentation number. How many words are behind each column is
 * its own chart (`WordsPerPresentationChart`); mixing the two on one pair of
 * axes made neither readable.
 */
export default function AccuracyByPresentationChart({ data }: { data: PresentationAccuracy[] }) {
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
        max: 100,
        tickInterval: 25,
        title: { ...axis.title, text: '% correct' },
        labels: { ...axis.labels, format: '{value}%' },
      },
      plotOptions: { column: { borderWidth: 0 }, series: { animation: false } },
      tooltip: { ...base.tooltip, headerFormat: '' },
      series: [
        {
          type: 'column',
          name: 'Accuracy',
          color: CORRECT_COLOR,
          data: data.map((point) => ({
            y: point.pct,
            custom: { ordinal: ordinal(point.n), count: point.count },
          })),
          tooltip: {
            pointFormat:
              '<b>{point.y:.0f}%</b> correct on the {point.custom.ordinal} presentation' +
              ' (n = {point.custom.count})',
          },
        },
      ],
    }
  }, [data, theme])

  if (data.length < 1) {
    return <EmptyState>No attempts yet — practise a few words to see this chart.</EmptyState>
  }

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
      containerProps={{ style: { width: '100%' } }}
    />
  )
}

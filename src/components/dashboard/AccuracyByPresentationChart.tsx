import { useTheme } from '@mui/material/styles'
import * as Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { useMemo } from 'react'
import type { PresentationAccuracy } from '../../lib/stats'
import { CORRECT_COLOR } from '../../theme'
import { axisTheme, baseChartOptions, ordinal } from '../chartOptions'
import EmptyState from './EmptyState'

/**
 * "How often do I get a word right the 1st / 2nd / 3rd time I see it?" —
 * accuracy per presentation number, with the sample size behind each bar.
 */
export default function AccuracyByPresentationChart({ data }: { data: PresentationAccuracy[] }) {
  const theme = useTheme()

  const options = useMemo<Highcharts.Options>(() => {
    const base = baseChartOptions(theme)
    const axis = axisTheme(theme)
    return {
      ...base,
      chart: {
        ...base.chart,
        type: 'column',
        // Two y axes: without this Highcharts forces a shared tick count and
        // stretches the percentage axis past 100 (0/40/80/120%).
        alignTicks: false,
      },
      xAxis: {
        ...axis,
        categories: data.map((point) => ordinal(point.n)),
        title: { ...axis.title, text: 'Presentation' },
      },
      yAxis: [
        {
          ...axis,
          min: 0,
          max: 100,
          tickInterval: 25,
          title: { ...axis.title, text: '% correct' },
          labels: { ...axis.labels, format: '{value}%' },
        },
        {
          ...axis,
          opposite: true,
          min: 0,
          gridLineWidth: 0,
          allowDecimals: false,
          title: { ...axis.title, text: 'Words' },
        },
      ],
      plotOptions: { column: { borderWidth: 0 }, series: { animation: false } },
      tooltip: {
        ...base.tooltip,
        headerFormat: '<span style="font-size:0.8em">{point.key} presentation</span><br/>',
      },
      series: [
        {
          type: 'column',
          name: 'Accuracy',
          color: CORRECT_COLOR,
          yAxis: 0,
          data: data.map((point) => ({ y: point.pct, custom: { count: point.count } })),
          tooltip: { pointFormat: '<b>{point.y:.0f}%</b> correct · n = {point.custom.count}' },
        },
        {
          type: 'line',
          name: 'Words at this presentation',
          color: theme.palette.text.disabled,
          yAxis: 1,
          marker: { enabled: false },
          lineWidth: 1,
          data: data.map((point) => point.count),
          tooltip: { pointFormat: '{series.name}: <b>{point.y}</b>' },
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

import type { Theme } from '@mui/material/styles'
import type { Options } from 'highcharts'

/** Chart height in px — small enough to fit a phone screen, tall enough to read. */
export const CHART_HEIGHT = 280

/**
 * Axis colours that follow the MUI theme mode. Shared by both axes of every
 * chart (the shape is deliberately plain so it can be spread into either an
 * x- or a y-axis).
 */
export function axisTheme(theme: Theme) {
  return {
    lineColor: theme.palette.divider,
    tickColor: theme.palette.divider,
    gridLineColor: theme.palette.divider,
    labels: { style: { color: theme.palette.text.secondary, fontSize: '0.75rem' } },
    title: { style: { color: theme.palette.text.secondary, fontSize: '0.75rem' } },
  }
}

/** Chrome shared by every chart: no credits, transparent, themed text. */
export function baseChartOptions(theme: Theme): Options {
  return {
    accessibility: { enabled: false },
    credits: { enabled: false },
    title: { text: undefined },
    chart: {
      backgroundColor: 'transparent',
      height: CHART_HEIGHT,
      spacing: [8, 8, 8, 8],
      style: { fontFamily: theme.typography.fontFamily },
    },
    legend: {
      itemStyle: { color: theme.palette.text.secondary, fontWeight: '400' },
      itemHoverStyle: { color: theme.palette.text.primary },
      itemHiddenStyle: { color: theme.palette.text.disabled },
    },
    tooltip: {
      backgroundColor: theme.palette.background.paper,
      borderColor: theme.palette.divider,
      style: { color: theme.palette.text.primary },
      headerFormat: '<span style="font-size:0.8em">{point.key}</span><br/>',
    },
  }
}

/** "1st", "2nd", "3rd", "4th", ... */
export function ordinal(n: number): string {
  const teens = n % 100
  if (teens >= 11 && teens <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/**
 * 'YYYY-MM-DD' -> epoch ms of that day's *local* midnight. `attemptsPerDay`
 * buckets by local calendar day and `highchartsSetup` puts the charts in the
 * local zone, so a datetime axis then labels each column with the day the
 * attempts were actually made.
 */
export function dayToLocalMs(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date).getTime()
}

import * as Highcharts from 'highcharts'

/** The browser's IANA zone, so every chart reads in the user's local time. */
function localTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

/**
 * One-time global Highcharts configuration, imported for its side effect from
 * `src/main.tsx` (and from `src/setupTests.ts`, so tests see the same charts).
 *
 * Highcharts 13 defaults `time.timezone` to `'UTC'`, which would label an
 * attempt made at 22:00 local as the next day. Everything in this app is
 * bucketed by local calendar day, so the charts must render in local time too.
 */
Highcharts.setOptions({
  time: { timezone: localTimeZone() },
  lang: { thousandsSep: ',' },
})

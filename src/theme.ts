import { createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { ThemeMode } from './lib/types'

/** Answer colours, shared by the practice card and every chart. */
export const CORRECT_COLOR = '#2e7d32'
export const INCORRECT_COLOR = '#c62828'

export type PaletteMode = 'light' | 'dark'

/** The palette the settings ask for: `system` defers to the device. */
export function resolvePaletteMode(mode: ThemeMode, prefersDark: boolean): PaletteMode {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}

export function createAppTheme(mode: PaletteMode): Theme {
  return createTheme({
    palette: {
      mode,
      success: { main: CORRECT_COLOR },
      error: { main: INCORRECT_COLOR },
    },
    shape: { borderRadius: 12 },
    typography: {
      h5: { fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { overscrollBehaviorY: 'contain' },
        },
      },
    },
  })
}

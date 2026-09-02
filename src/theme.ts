import { createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

/** Answer colours, shared by the practice card and every chart. */
export const CORRECT_COLOR = '#2e7d32'
export const INCORRECT_COLOR = '#c62828'

export function createAppTheme(mode: 'light' | 'dark'): Theme {
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

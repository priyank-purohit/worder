import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { useEffect, useMemo } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { StoreProvider, useStore } from './hooks/useStore'
import { WordListProvider } from './hooks/useWordList'
import DashboardPage from './pages/DashboardPage'
import PhrasesPage from './pages/PhrasesPage'
import PracticePage from './pages/PracticePage'
import SettingsPage from './pages/SettingsPage'
import WordsPage from './pages/WordsPage'
import { createAppTheme, resolvePaletteMode } from './theme'

/** Keep the browser UI (iOS status bar, Android toolbar) with the palette. */
function useThemeColorMeta(theme: Theme) {
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme.palette.background.default)
  }, [theme])
}

/**
 * The app under the theme the settings ask for. Separate from `App` because the
 * chosen mode lives in the store, which can only be read inside its provider.
 */
function ThemedApp({ prefersDark }: { prefersDark: boolean }) {
  const { store } = useStore()
  const mode = resolvePaletteMode(store.settings.themeMode, prefersDark)
  const theme = useMemo(() => createAppTheme(mode), [mode])
  useThemeColorMeta(theme)

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<PracticePage />} />
            <Route path="/phrases" element={<PhrasesPage />} />
            <Route path="/phrases/stats" element={<PhrasesPage />} />
            <Route path="/words" element={<WordsPage />} />
            <Route path="/words/:key" element={<WordsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}

export default function App() {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  // Themes only what renders before the store exists — the word-file spinner
  // and its error state — which can do nothing but follow the device.
  const systemTheme = useMemo(() => createAppTheme(prefersDark ? 'dark' : 'light'), [prefersDark])

  return (
    <ThemeProvider theme={systemTheme}>
      <WordListProvider>
        <StoreProvider>
          <ThemedApp prefersDark={prefersDark} />
        </StoreProvider>
      </WordListProvider>
    </ThemeProvider>
  )
}

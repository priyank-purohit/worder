import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material'
import { useMemo } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { StoreProvider } from './hooks/useStore'
import { WordListProvider } from './hooks/useWordList'
import DashboardPage from './pages/DashboardPage'
import PracticePage from './pages/PracticePage'
import SettingsPage from './pages/SettingsPage'
import WordsPage from './pages/WordsPage'
import { createAppTheme } from './theme'

export default function App() {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const theme = useMemo(() => createAppTheme(prefersDark ? 'dark' : 'light'), [prefersDark])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <WordListProvider>
        <StoreProvider>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<PracticePage />} />
                <Route path="/words" element={<WordsPage />} />
                <Route path="/words/:key" element={<WordsPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        </StoreProvider>
      </WordListProvider>
    </ThemeProvider>
  )
}

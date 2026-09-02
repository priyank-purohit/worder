import InsightsIcon from '@mui/icons-material/Insights'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import StyleIcon from '@mui/icons-material/Style'
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Container,
  Paper,
  Tab,
  Tabs,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { ElementType } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

interface NavItem {
  label: string
  path: string
  Icon: ElementType
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Practice', path: '/', Icon: StyleIcon },
  { label: 'Words', path: '/words', Icon: SearchIcon },
  { label: 'Dashboard', path: '/dashboard', Icon: InsightsIcon },
  { label: 'Settings', path: '/settings', Icon: SettingsIcon },
]

/** The nav item that owns the current route (`/words/xyz` -> `/words`). */
function activePath(pathname: string): string {
  const match = NAV_ITEMS.filter(
    (item) => item.path !== '/' && (pathname === item.path || pathname.startsWith(`${item.path}/`)),
  ).sort((a, b) => b.path.length - a.path.length)[0]
  return match?.path ?? '/'
}

const BOTTOM_NAV_HEIGHT = 56

export default function Layout() {
  const theme = useTheme()
  const wide = useMediaQuery(theme.breakpoints.up('md'))
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const current = activePath(pathname)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {wide && (
        <AppBar position="sticky" color="default" enableColorOnDark elevation={1}>
          <Toolbar sx={{ gap: 3 }}>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
              worder
            </Typography>
            <Tabs
              value={current}
              onChange={(_, value: string) => navigate(value)}
              textColor="inherit"
            >
              {NAV_ITEMS.map(({ label, path, Icon }) => (
                <Tab key={path} value={path} label={label} icon={<Icon />} iconPosition="start" />
              ))}
            </Tabs>
          </Toolbar>
        </AppBar>
      )}

      <Container
        component="main"
        maxWidth="md"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: 2,
          // Keep content clear of the fixed bottom nav (plus the iOS home bar).
          pb: wide ? 2 : `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom) + 16px)`,
        }}
      >
        <Outlet />
      </Container>

      {!wide && (
        <Paper
          elevation={3}
          square
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: (t) => t.zIndex.appBar,
            pb: 'env(safe-area-inset-bottom)',
          }}
        >
          <BottomNavigation
            showLabels
            value={current}
            onChange={(_, value: string) => navigate(value)}
          >
            {NAV_ITEMS.map(({ label, path, Icon }) => (
              <BottomNavigationAction key={path} value={path} label={label} icon={<Icon />} />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  )
}

import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness'
import { Box, FormHelperText, ToggleButton, ToggleButtonGroup } from '@mui/material'
import type { ElementType } from 'react'
import { useStore } from '../../hooks/useStore'
import type { ThemeMode } from '../../lib/types'
import SettingsSection from './SettingsSection'

interface Choice {
  value: ThemeMode
  label: string
  Icon: ElementType
}

const CHOICES: Choice[] = [
  { value: 'system', label: 'System', Icon: SettingsBrightnessIcon },
  { value: 'light', label: 'Light', Icon: LightModeIcon },
  { value: 'dark', label: 'Dark', Icon: DarkModeIcon },
]

/** Light / dark / follow-the-device. */
export default function AppearanceSection() {
  const { store, updateSettings } = useStore()
  const { themeMode } = store.settings

  return (
    <SettingsSection title="Appearance">
      <Box>
        <ToggleButtonGroup
          exclusive
          fullWidth
          color="primary"
          value={themeMode}
          aria-label="Theme"
          onChange={(_event, next: ThemeMode | null) => {
            // Clicking the already-selected button reports null: keep it.
            if (next !== null) updateSettings({ themeMode: next })
          }}
        >
          {CHOICES.map(({ value, label, Icon }) => (
            <ToggleButton key={value} value={value} sx={{ gap: 1, textTransform: 'none' }}>
              <Icon fontSize="small" />
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <FormHelperText>System follows your device setting.</FormHelperText>
      </Box>
    </SettingsSection>
  )
}

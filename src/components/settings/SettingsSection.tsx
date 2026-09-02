import { Paper, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

export interface SettingsSectionProps {
  title: string
  children: ReactNode
}

/** One titled card on the settings page. */
export default function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h6" component="h3" gutterBottom>
        {title}
      </Typography>
      <Stack spacing={3} sx={{ mt: 2 }}>
        {children}
      </Stack>
    </Paper>
  )
}

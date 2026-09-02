import { Container, Stack, Typography } from '@mui/material'
import DataSection from '../components/settings/DataSection'
import PracticeSection from '../components/settings/PracticeSection'
import WordFileSection from '../components/settings/WordFileSection'

export default function SettingsPage() {
  return (
    <Container maxWidth="sm" disableGutters sx={{ pb: 2 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Settings
      </Typography>
      <Stack spacing={3} sx={{ mt: 2 }}>
        <PracticeSection />
        <WordFileSection />
        <DataSection />
      </Stack>
    </Container>
  )
}

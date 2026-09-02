import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import DownloadIcon from '@mui/icons-material/Download'
import UploadIcon from '@mui/icons-material/Upload'
import { Alert, Box, Button, Divider, Snackbar, Stack, Typography } from '@mui/material'
import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useStore } from '../../hooks/useStore'
import { STORAGE_KEY } from '../../lib/storage'
import type { AllStats } from '../../lib/types'
import ConfirmDialog from './ConfirmDialog'
import SettingsSection from './SettingsSection'

type Pending = { kind: 'import'; text: string } | { kind: 'reset' } | null
interface Toast {
  severity: 'success' | 'error'
  message: string
}

function countAttempts(stats: AllStats): number {
  return Object.values(stats).reduce(
    (total, byKey) =>
      total + Object.values(byKey).reduce((sum, attempts) => sum + attempts.length, 0),
    0,
  )
}

/** Local date as `YYYY-MM-DD`, for the export file name. */
function today(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Export / import / reset of everything held on this device. */
export default function DataSection() {
  const { store, exportJson, importJson, resetStats } = useStore()
  const [pending, setPending] = useState<Pending>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const totalAttempts = countAttempts(store.stats)

  function handleExport() {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `worder-stats-${today()}.json`
    document.body.append(link)
    link.click()
    link.remove()
    // Revoking synchronously can cancel the download in Safari and Firefox,
    // which read the blob after the click handler returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setToast({ severity: 'success', message: 'Stats exported' })
  }

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Clear the input so picking the same file again still fires a change.
    event.target.value = ''
    if (!file) return
    try {
      setPending({ kind: 'import', text: await file.text() })
    } catch {
      setToast({ severity: 'error', message: 'Could not read that file.' })
    }
  }

  function confirmImport() {
    if (pending?.kind !== 'import') return
    try {
      importJson(pending.text)
      setToast({ severity: 'success', message: 'Stats imported' })
    } catch (err) {
      setToast({
        severity: 'error',
        message: err instanceof Error ? err.message : 'That file could not be imported.',
      })
    } finally {
      setPending(null)
    }
  }

  function confirmReset() {
    resetStats()
    setPending(null)
    setToast({ severity: 'success', message: 'Stats cleared' })
  }

  return (
    <SettingsSection title="Data">
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {totalAttempts.toLocaleString()} attempt{totalAttempts === 1 ? '' : 's'} recorded across
          all languages · stored under{' '}
          <Box component="code" sx={{ fontFamily: 'monospace' }}>
            {STORAGE_KEY}
          </Box>
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport} fullWidth>
            Export stats
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => fileInput.current?.click()}
            fullWidth
          >
            Import stats
          </Button>
        </Stack>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            void handleFileChosen(event)
          }}
          data-testid="import-file-input"
        />

        <Divider />

        <Box>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={() => setPending({ kind: 'reset' })}
            fullWidth
          >
            Reset all stats
          </Button>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            Settings are kept; every recorded attempt is deleted.
          </Typography>
        </Box>
      </Stack>

      <ConfirmDialog
        open={pending?.kind === 'import'}
        title="Import stats?"
        body="This replaces all current stats and settings on this device."
        confirmLabel="Import"
        onConfirm={confirmImport}
        onClose={() => setPending(null)}
      />

      <ConfirmDialog
        open={pending?.kind === 'reset'}
        title="Reset all stats?"
        body="This permanently deletes every attempt recorded on this device. Settings are kept."
        confirmLabel="Clear stats"
        destructive
        onConfirm={confirmReset}
        onClose={() => setPending(null)}
      />

      <Snackbar
        open={toast !== null}
        autoHideDuration={5000}
        // A stray click elsewhere should not swallow the message.
        onClose={(_event, reason) => {
          if (reason !== 'clickaway') setToast(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 88, md: 24 } }}
      >
        <Alert
          severity={toast?.severity ?? 'success'}
          variant="filled"
          onClose={() => setToast(null)}
          sx={{ width: '100%' }}
        >
          {toast?.message ?? ''}
        </Alert>
      </Snackbar>
    </SettingsSection>
  )
}

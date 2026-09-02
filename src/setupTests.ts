import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
// The app's global Highcharts config, so charts behave the same under test.
import './lib/highchartsSetup'

// `globals: false` means Testing Library cannot register its own auto-cleanup.
afterEach(cleanup)

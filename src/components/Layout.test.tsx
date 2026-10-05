import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Layout from './Layout'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<p>practice</p>} />
          <Route path="/phrases" element={<p>phrases</p>} />
          <Route path="/phrases/stats" element={<p>phrase stats</p>} />
          <Route path="/words" element={<p>words</p>} />
          <Route path="/words/:key" element={<p>word</p>} />
          <Route path="/settings" element={<p>settings</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const main = () => screen.getByRole('main')
const shell = () => main().parentElement as HTMLElement

describe('Layout', () => {
  it('pins the shell to one viewport and clips it on Practice only', () => {
    renderAt('/')
    expect(shell()).toHaveClass('viewport-shell')
    // `min-height: 0` lets the flex item shrink below its content, and the
    // overflow clips what is left over.
    expect(getComputedStyle(main()).overflow).toBe('hidden')
    expect(getComputedStyle(main()).minHeight).toBe('0px')
  })

  it('pins the shell on the phrase deck too, but not on its stats view', () => {
    renderAt('/phrases')
    expect(shell()).toHaveClass('viewport-shell')
    expect(getComputedStyle(main()).overflow).toBe('hidden')

    renderAt('/phrases/stats')
    const stats = screen.getAllByRole('main')[1]
    expect(stats.parentElement).not.toHaveClass('viewport-shell')
    expect(getComputedStyle(stats).overflow).not.toBe('hidden')
  })

  it('has a Phrases tab between Practice and Words', () => {
    renderAt('/phrases/stats')
    const labels = screen.getAllByRole('button').map((button) => button.textContent)
    expect(labels).toEqual(['Practice', 'Phrases', 'Words', 'Dashboard', 'Settings'])
  })

  it.each(['/words', '/words/eau%3A%3Awater', '/settings'])(
    'lets %s scroll, keeping the flex item as tall as its content',
    (path) => {
      renderAt(path)
      expect(shell()).not.toHaveClass('viewport-shell')
      expect(getComputedStyle(main()).overflow).not.toBe('hidden')
      // Not `0`: the automatic minimum size is what keeps the container's
      // bottom padding — which holds a long page clear of the bottom nav —
      // inside the element rather than overflowing it.
      expect(getComputedStyle(main()).minHeight).not.toBe('0px')
    },
  )

  it('gives the word grid a wider container than the rest of the app', () => {
    renderAt('/words')
    expect(main()).toHaveClass('MuiContainer-maxWidthLg')

    renderAt('/settings')
    expect(screen.getAllByRole('main')[1]).toHaveClass('MuiContainer-maxWidthMd')
  })
})

import { useEffect } from 'react'

/**
 * Belt and braces over `Layout`'s `.viewport-shell`: while a card deck is on
 * screen the document itself may not scroll either, so no bounce or vertical
 * pan can interrupt a swipe. Restored when the route unmounts or `active`
 * turns false — a page that only sometimes shows a deck passes that in.
 */
export function useNoDocumentScroll(active = true) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return
    const { body } = document
    const previous = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previous
    }
  }, [active])
}

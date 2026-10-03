import { useEffect, useRef, useState } from 'react'

/**
 * Compares each poll with the previous one and returns the ids that are
 * new (`added`) or different (`changed`) for a short moment, so rows can flash.
 * Nothing is highlighted on the very first load.
 */
export function useChangedIds<T extends { id: number }>(items: T[] | null, duration = 1600) {
  const prev = useRef<Map<number, string> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [state, setState] = useState({ added: new Set<number>(), changed: new Set<number>() })

  useEffect(() => {
    if (!items) return
    const next = new Map(items.map((i) => [i.id, JSON.stringify(i)]))
    const before = prev.current
    prev.current = next
    if (!before) return

    const added = new Set<number>()
    const changed = new Set<number>()
    next.forEach((sig, id) => {
      if (!before.has(id)) added.add(id)
      else if (before.get(id) !== sig) changed.add(id)
    })
    if (added.size === 0 && changed.size === 0) return

    setState({ added, changed })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState({ added: new Set(), changed: new Set() }), duration)
  }, [items, duration])

  useEffect(() => () => clearTimeout(timer.current), [])

  return state
}

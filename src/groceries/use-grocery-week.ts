import { useEffect, useRef, useState } from 'react'
import { getGroceryWeek } from '../data/grocery-store'
import type { MealSlot } from '../data/organizer'
import type { GroceryWeek } from './grocery-list'

type WeekState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; snapshot: GroceryWeek | null }

export function useGroceryWeek(monday: string, planRevision?: readonly MealSlot[]) {
  const [loaded, setLoaded] = useState<{ monday: string; state: WeekState } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const latest = useRef(0)

  useEffect(() => {
    let cancelled = false
    const request = ++latest.current
    getGroceryWeek(monday).then(
      (snapshot) => {
        if (!cancelled && request === latest.current) setLoaded({ monday, state: { status: 'ready', snapshot } })
      },
      () => {
        if (!cancelled && request === latest.current) setLoaded({ monday, state: { status: 'error' } })
      },
    )
    return () => { cancelled = true }
  }, [monday, attempt, planRevision])

  function replace(snapshot: GroceryWeek) {
    latest.current += 1
    setLoaded({ monday: snapshot.weekStart, state: { status: 'ready', snapshot } })
  }

  function retry() {
    setLoaded(null)
    setAttempt((value) => value + 1)
  }

  const state: WeekState = loaded?.monday === monday ? loaded.state : { status: 'loading' }
  return { state, replace, retry }
}

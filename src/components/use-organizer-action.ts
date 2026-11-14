import { useState } from 'react'
import { recipeWriteError } from '../data/use-recipe-library'

export function useOrganizerAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action: string, operation: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await operation()
    } catch (error) {
      setError(recipeWriteError(error, action))
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, run }
}

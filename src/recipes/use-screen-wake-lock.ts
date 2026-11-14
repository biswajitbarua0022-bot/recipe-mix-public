import { useEffect, useState } from 'react'

export function useScreenWakeLock(enabled: boolean) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const wakeLock = navigator.wakeLock
    if (!enabled || !wakeLock) return

    let disposed = false
    let requesting = false
    let requestOnSettle = false
    let held: WakeLockSentinel | undefined

    function onRelease() {
      held = undefined
      setActive(false)
    }

    function releaseHeldLock() {
      const lock = held
      if (!lock) return
      lock.removeEventListener('release', onRelease)
      onRelease()
      if (!lock.released) void lock.release().catch(() => {})
    }

    async function acquire() {
      if (disposed || requesting || held || document.visibilityState !== 'visible') return
      requesting = true
      try {
        const lock = await wakeLock.request('screen')
        if (disposed || document.visibilityState !== 'visible') {
          if (!lock.released) await lock.release().catch(() => {})
          return
        }
        if (lock.released) return
        held = lock
        lock.addEventListener('release', onRelease, { once: true })
        setActive(true)
      } catch {
        if (!disposed) setActive(false)
      } finally {
        requesting = false
        if (requestOnSettle) {
          requestOnSettle = false
          void acquire()
        }
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') releaseHeldLock()
      else if (requesting) requestOnSettle = true
      else void acquire()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    void acquire()
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      releaseHeldLock()
    }
  }, [enabled])

  return enabled && active
}

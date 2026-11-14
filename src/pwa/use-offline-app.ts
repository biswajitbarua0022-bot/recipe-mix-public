import { useEffect, useState } from 'react'

export function useOfflineApp() {
  const [online, setOnline] = useState(navigator.onLine)
  const [offlineReady, setOfflineReady] = useState(false)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', syncOnline)
    window.addEventListener('offline', syncOnline)
    return () => {
      window.removeEventListener('online', syncOnline)
      window.removeEventListener('offline', syncOnline)
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    const workers = navigator.serviceWorker
    let registration: ServiceWorkerRegistration | undefined
    let installing: ServiceWorker | null = null
    let disposed = false

    function syncWorker() {
      setOfflineReady(Boolean(workers.controller))
      setWaiting(registration?.waiting ?? null)
    }

    function watchInstall() {
      installing?.removeEventListener('statechange', syncWorker)
      installing = registration?.installing ?? null
      installing?.addEventListener('statechange', syncWorker)
    }

    workers.addEventListener('controllerchange', syncWorker)
    const base = import.meta.env.BASE_URL
    void workers.register(`${base}sw.js`, { scope: base, updateViaCache: 'none' }).then((result) => {
      if (disposed) return
      registration = result
      syncWorker()
      watchInstall()
      registration.addEventListener('updatefound', watchInstall)
    }).catch(() => {})
    return () => {
      disposed = true
      registration?.removeEventListener('updatefound', watchInstall)
      installing?.removeEventListener('statechange', syncWorker)
      workers.removeEventListener('controllerchange', syncWorker)
    }
  }, [])

  function applyUpdate() {
    if (!waiting) return
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
    waiting.postMessage('APPLY_UPDATE')
  }

  return { online, offlineReady, hasUpdate: waiting !== null, applyUpdate }
}

export type OfflineApp = ReturnType<typeof useOfflineApp>

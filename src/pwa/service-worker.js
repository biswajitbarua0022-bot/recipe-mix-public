/* global self, caches, Request, URL, fetch, BUILD_VERSION, APP_FILES */
const cachePrefix = 'recipe-mix-public-shell:'
const cacheName = cachePrefix + BUILD_VERSION
const shell = new URL('index.html', self.registration.scope).href
const assets = new Set(APP_FILES.map((path) => new URL(path, self.registration.scope).href))

self.addEventListener('install', (event) => {
  const requests = Array.from(assets, (url) => new Request(url, { cache: 'reload' }))
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(requests)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(cachePrefix) && key !== cacheName) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data === 'APPLY_UPDATE') event.waitUntil(self.skipWaiting())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  const isShell = request.mode === 'navigate' && (url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL(shell).pathname)
    && url.origin === self.location.origin
  const target = isShell ? shell : request.url
  if (!assets.has(target)) return

  event.respondWith((async () => {
    const cache = await caches.open(cacheName)
    return (await cache.match(target)) ?? fetch(request)
  })())
})

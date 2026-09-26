const CACHE = 'kamin-public-v8'
const CORE = [
  '/favicon.svg',
  '/manifest.json',
  '/kamin-logo-v3.webp',
  '/icon-192.png',
  '/icon-512.png',
  '/privacy.html',
  '/faq.html',
  '/mapping.html',
  '/static-i18n.js',
  '/knowledge/ict-kg-v1.jsonld'
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('kamin-public-') && key !== CACHE).map(key => caches.delete(key))
    ))
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()))
          return response
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('/privacy.html')))
    )
    return
  }

  const immutable = url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/ocr/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/knowledge/') ||
    ['/kamin-logo-v3.webp','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/og-kamin-1200x630.jpg'].includes(url.pathname)

  if (immutable) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()))
        return response
      }))
    )
    return
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

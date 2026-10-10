const CACHE = 'softtek-shell-v1'
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/brand/softtek.svg', '/brand/app-icon.png', '/manifest.webmanifest'])))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('softtek-shell-') && key !== CACHE).map(key => caches.delete(key)))))
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  const staticAsset = /^\/(assets|fonts|brand)\//.test(url.pathname) || url.pathname === '/manifest.webmanifest'
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || (event.request.mode !== 'navigate' && !staticAsset)) return
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)))
    }
    return response
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match('/') : undefined) || Response.error()))
})

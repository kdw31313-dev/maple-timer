const prefix = new URL(self.registration.scope);
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== prefix.origin) return;
  // Vite can build root-relative preload paths at runtime.
  if (/^\/(?:assets|models|vendor|sounds|fonts|skill-icons|buff-icons|images|videos|guide-videos|icons)\//.test(url.pathname) || /^\/(?:build-info|release-notes)\.json$/.test(url.pathname)) {
    event.respondWith(fetch(new URL('runtime' + url.pathname + url.search, prefix)));
  }
});
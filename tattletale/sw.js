/* TattleTale NYC service worker: works offline after the first visit. */
const VERSION = 'tt-v2';
const SHELL = ['./', 'index.html', 'app.js', 'ocr-worker.js', 'lib/exifr.lite.umd.js', 'lib/geocode.js', 'lib/mp4meta.js', 'manifest.webmanifest', 'geo/intersections.json', 'icons/icon-192.png', 'icons/icon-512.png', 'geo/index.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => /^(tt|curb)-/.test(k) && k !== VERSION && k !== 'tt-share').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // photos and videos shared to TattleTale from the gallery or camera app
  if (e.request.method === 'POST' && url.origin === self.location.origin && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const f = form.getAll('media').find(x => x && typeof x !== 'string');
        if (f) {
          const c = await caches.open('tt-share');
          await c.put('shared-media', new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name || 'shared'), 'x-modified': String(f.lastModified || Date.now()) } }));
        }
      } catch (err) {}
      return Response.redirect(new URL('./#shared', self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const heavy = /\/(vendor|models|geo|icons)\//.test(url.pathname);
  if (heavy) {
    e.respondWith(caches.open(VERSION).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
  } else {
    e.respondWith(fetch(e.request).then(r => { if (r.ok) caches.open(VERSION).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
  }
});

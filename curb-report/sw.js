/* Curb Report is now TattleTale NYC (../tattletale/). This worker forwards copies installed under the old name. */
const NEW = new URL('../tattletale/', self.registration.scope).href;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (/^curb-/.test(k)) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const f = form.getAll('media').find(x => x && typeof x !== 'string');
        if (f) await (await caches.open('tt-share')).put('shared-media', new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name || 'shared'), 'x-modified': String(f.lastModified || Date.now()) } }));
      } catch (err) {}
      return Response.redirect(NEW + '#shared', 303);
    })());
    return;
  }
  if (e.request.mode === 'navigate') e.respondWith(Response.redirect(NEW, 302));
});

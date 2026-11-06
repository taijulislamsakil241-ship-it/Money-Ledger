const CACHE = 'money-ledger-v5';
const CORE = ['./', './index.html', './manifest.json', './icon.svg'];
// Optional extras (fonts stylesheet + Excel library): cached best-effort so import/export also work offline
const EXTRA = ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (r.ok) return c.put(u, r); throw new Error(u); })));
    await Promise.all(EXTRA.map(u => fetch(u, { mode: 'no-cors' }).then(r => c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Anything from another site except fonts and the Excel library (e.g. live exchange rates): straight to the network, never cached
  if (url.origin !== location.origin && !/(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/.test(url.hostname)) return;

  // Page navigation: open instantly from cache (works offline), refresh the cache in the background
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(hit => {
        const net = fetch(req).then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
          return res;
        }).catch(() => null);
        if (hit) { e.waitUntil(net); return hit; }
        return net.then(r => r || caches.match('./'));
      })
    );
    return;
  }

  // Everything else (own files, fonts, Excel library): cache first, then network and store
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req)
        .then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => new Response('', { status: 504, statusText: 'offline' }));
    })
  );
});

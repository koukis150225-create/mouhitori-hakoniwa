// もうひとりの箱庭: the page itself is always fetched fresh when online (so updates arrive
// right away) and falls back to the saved copy when offline. Icons and libraries are cached.
const CACHE = 'hakoniwa-v2';
const SHELL = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const lib = /cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.host);
  if (!same && !lib) return;
  if (same && (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/'))) {
    if (url.searchParams.has('check')) return;                       // version checks go straight to the network
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(req, {cache: 'no-store', signal: ctrl.signal}); clearTimeout(tm);
        if (res && res.ok) c.put('./index.html', res.clone());
        return res;
      } catch (err) {
        return (await c.match('./index.html')) || new Response('offline', {status: 503});
      }
    })());
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, {ignoreSearch: same});
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('offline', {status: 503});
  }));
});

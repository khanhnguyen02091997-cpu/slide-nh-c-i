// Offline shell for the installed app. Pages and scripts: network first, cache as fallback,
// so a new deploy shows up on the next open. API calls and Supabase are never cached.
const CACHE = "slide-cuoi-v13";
const SHELL = ["/", "/index.html", "/albums.html", "/studio.html", "/css/app.css", "/js/common.js", "/js/engine.js", "/js/album.js", "/js/studio.js", "/js/pwa.js", "/icons/icon-192.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  const ours = u.origin === location.origin && !u.pathname.startsWith("/api/");
  const libs = /^(cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com)$/.test(u.hostname);
  if (e.request.method !== "GET" || !(ours || libs)) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: u.pathname.endsWith(".html") || u.pathname === "/" })));
});

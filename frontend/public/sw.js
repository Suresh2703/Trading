/* Service worker for the installed mobile app.
 *
 * Scope: the app shell only — the HTML, JS, CSS and icons served from this
 * origin. Cache-first, because a hashed filename can never mean anything
 * different than it did the first time, and a navigation falls back to the
 * cached shell so launching from the home screen with no signal still opens
 * the app.
 *
 * What this worker deliberately does NOT do is stand between the app and its
 * API. An earlier version intercepted those cross-origin GETs to keep the last
 * figures readable offline, and the cost of that was badly out of proportion:
 * when the worker's own fetch failed for any reason, every screen reported
 * "No connection" even though the network and the backend were both fine. The
 * API path is the one thing the app cannot do without, so nothing optional is
 * allowed to sit in front of it.
 *
 * Offline reading of the figures belongs in the app instead, where the code
 * already knows what the payload means and a failure degrades to stale data
 * rather than to a fabricated error.
 */
const VERSION = 'v2';
const SHELL = `erp-shell-${VERSION}`;

// Enough to boot the app with no network. Everything else arrives on demand.
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/logo.png', '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // addAll is all-or-nothing; one 404 would leave the app with no shell at
    // all, so each entry is allowed to fail on its own.
    caches.open(SHELL)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        // Drops the previous version's shell, and the data cache that older
        // versions of this worker kept.
        keys.filter((key) => key !== SHELL).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  // Sign-out clears anything this worker is holding. It keeps no business
  // data now, but a device that installed an older version may still have its
  // data cache, and that must not survive a sign-out.
  if (event.data?.type === 'purge-data') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key !== SHELL).map((key) => caches.delete(key))))
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Anything not served from this origin is the API. Left completely alone —
  // no respondWith — so the browser makes the request exactly as it would
  // with no worker installed.
  if (new URL(request.url).origin !== self.location.origin) return;

  // A navigation is the app being opened. Serve the shell from cache when the
  // network is gone, so launching from the home screen offline still works.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((hit) => hit
        || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } })))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(SHELL).then((c) => c.put(request, copy));
      }
      return response;
    }))
  );
});

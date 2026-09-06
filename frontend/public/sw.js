// A service worker that caches nothing.
//
// Chrome will not offer "Install app" without one registered that has a fetch
// handler, so this exists to satisfy that and nothing else. Caching would be
// actively wrong here: every screen is behind a session and shows one person's
// pay and leave, and a stale response served to the next person to open the
// app on a shared phone is a worse bug than any offline support is worth.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  // Straight to the network, every time.
  event.respondWith(fetch(event.request));
});

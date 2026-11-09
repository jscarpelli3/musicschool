/* Common Time PWA lifecycle worker.
 * Authenticated school data is intentionally never cached here. */
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",(event)=>event.waitUntil(self.clients.claim()));

const C='afield-direct-core-20260919-1718';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister().then(()=>self.clients.claim())));

const C='weekeat-v7';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.json','icon-180.png','icon-192.png','prices.json'])));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
// спершу мережа (щоб бачити нові версії й ціни), без інтернету — збережена копія
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request.url.split('?')[0],cp));return r}).catch(()=>caches.match(e.request.url.split('?')[0]).then(m=>m||caches.match('index.html'))))});

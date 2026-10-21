const CACHE='rail-rush-v1';
const PRECACHE=/*PRECACHE*/[];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(PRECACHE.length?PRECACHE:['./']);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('rail-rush-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  // Check the server for the entry page on every visit. Offline play still uses
  // the saved entry, but a previous release can no longer pin the browser to it.
  if(event.request.mode==='navigate'){
   try{
    const response=await fetch(event.request,{cache:'no-store'});
    if(response.ok){await cache.put(new URL('./',self.registration.scope).href,response.clone());return response;}
    const saved=await cache.match(new URL('./',self.registration.scope).href);
    return saved||response;
   }catch(error){
    const saved=await cache.match(new URL('./',self.registration.scope).href);
    if(saved)return saved;
    throw error;
   }
  }
  // Only consult this release's cache, never another build's cached files.
  const cached=await cache.match(event.request);
  return cached||fetch(event.request);
 })());
});

const CACHE='multiverse-708951d55f7a39f1';
const SHELL=["app.js", "data.json", "engine.js", "icon-192.png", "icon-512.png", "index.html", "lol-duel-engine.js", "lol-duel.css", "lol-duel.html", "lol-duel.js", "manifest.webmanifest", "style.css"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('multiverse-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})());});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const url=new URL(e.request.url);
  if(url.pathname.endsWith('/'))url.pathname+='index.html';
  const key=e.request.mode==='navigate'?url.href:e.request;
  const cached=await cache.match(key); if(cached)return cached;
  const res=await fetch(e.request); if(res.ok)await cache.put(key,res.clone());return res;
 })());
});
// Explicit download: all files are acknowledged, never silently claim success.
self.addEventListener('message',e=>{
 if(e.data?.type!=='CACHE_PACK')return;
 const port=e.ports[0];
 e.waitUntil((async()=>{try{
  const cache=await caches.open(CACHE);let done=0;
  for(const path of e.data.paths){
   const url=new URL(path,self.registration.scope);
   if(url.origin!==self.location.origin)throw Error('Origine invalide');
   if(!await cache.match(url.href)){const r=await fetch(url.href);if(!r.ok)throw Error(`Téléchargement impossible : ${path}`);await cache.put(url.href,r);}
   port.postMessage({done:++done,total:e.data.paths.length});
  }
  port.postMessage({complete:true});
 }catch(err){port.postMessage({error:err.message});}})());
});

'use strict';
const CACHE='henu-classroom-2026-v23';
const ASSETS=['./','./index.html','./styles.css?v=18','./core.js?v=11','./flow.js','./app.js?v=23','./personal-timetable.js','./timetable-ui.js','./data.js','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png','./assets/rough.js','./assets/study-note-hand.woff2','./assets/ink-dog-app-icon.png','./assets/ink-dog-time.png','./assets/ink-dog-low.png','./assets/ink-dog-balanced.png','./assets/ink-dog-quiet.png','./assets/ink-dog-results.png','./assets/ink-dog-empty.png','./assets/ink-dog-favorites.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    for(const asset of ASSETS){
      const response=await fetch(asset,{cache:'reload'});
      if(!response.ok || response.redirected)throw new Error('资源暂不可用');
      if(asset==='./' || asset==='./index.html'){
        if(!(await response.clone().text()).includes('data-classroom-app'))throw new Error('登录后再安装');
      }
      await cache.put(asset,response);
    }
    await self.skipWaiting();
  }));
});
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('henu-classroom-') && k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET' || url.origin!==self.location.origin)return;
  const isAsset=ASSETS.some(a=>new URL(a,self.registration.scope).pathname===url.pathname);
  if(!isAsset)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(event.request);
      if(response.ok && !response.redirected){
        const isHTML=event.request.mode==='navigate';
        if(!isHTML || (await response.clone().text()).includes('data-classroom-app'))await cache.put(event.request,response.clone());
      }
      return response;
    }catch(error){
      const stored=await cache.match(event.request,{ignoreSearch:true});
      if(stored)return stored;
      if(event.request.mode==='navigate'){
        const home=await cache.match('./index.html');
        if(home)return home;
      }
      throw error;
    }
  })());
});

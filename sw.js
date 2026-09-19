const C='afield-1-9-refine-rematch-20260919-1625';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))))]))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||e.request.mode!=='navigate')return;
  e.respondWith((async()=>{
    const r=await fetch(e.request,{cache:'no-store'});
    const ct=r.headers.get('content-type')||'';
    if(!ct.includes('text/html'))return r;
    let html=await r.text();
    const bundle=`<script src="./instagram-source-rematch.js?v=20260919-1625"><\/script><script src="./refine-v2.js?v=20260919-1625"><\/script>`;
    if(!html.includes('instagram-source-rematch.js'))html=html.replace('</body>',bundle+'</body>');
    const h=new Headers(r.headers);h.delete('content-length');
    return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
  })().catch(()=>fetch(e.request,{cache:'reload'})));
});
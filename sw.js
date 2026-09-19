const C='afield-1-8-refine-20260919-1335';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(k=>Promise.all(k.map(x=>caches.delete(x))))]))});
const MAPS_DEBUG=`<script>(function(){
  let last='';
  function keyTail(){try{const s=[...document.scripts].find(x=>x.src&&x.src.includes('maps.googleapis.com/maps/api/js'));if(!s)return '(script not found)';const k=new URL(s.src).searchParams.get('key')||'';return k?('…'+k.slice(-6)):'(no key param)'}catch(e){return '(unavailable)'}}
  function show(kind,msg){
    const text=String(msg||'').trim();
    const signature=kind+'|'+text;
    if(signature===last)return;last=signature;
    let p=document.getElementById('__afieldMapsDebug');
    if(!p){p=document.createElement('div');p.id='__afieldMapsDebug';p.style.cssText='position:fixed;left:12px;right:12px;bottom:94px;z-index:2147483647;background:#111;color:#fff;border-radius:18px;padding:14px 16px;font:12px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 18px 50px #0005;white-space:pre-wrap;word-break:break-word';document.body.appendChild(p)}
    p.textContent='Google Maps diagnostic\n'+kind+(text?'\n'+text:'')+'\nHOST '+location.host+'\nPATH '+location.pathname+'\nKEY '+keyTail();
  }
  window.gm_authFailure=function(){show('gm_authFailure','Google이 이 API key 또는 프로젝트의 지도 사용을 거부했습니다.')};
  const oldErr=console.error.bind(console);
  console.error=function(){oldErr(...arguments);const t=[...arguments].map(x=>{try{return typeof x==='string'?x:JSON.stringify(x)}catch(e){return String(x)}}).join(' ');if(/Google Maps|maps\.googleapis|RefererNotAllowed|ApiNotActivated|InvalidKey|ProjectDenied|Billing|ApiTargetBlocked|InvalidAppCheckToken|REQUEST_DENIED/i.test(t))show('console.error',t)};
  window.addEventListener('error',e=>{const t=String(e.message||e.error||'');if(/Google Maps|maps\.googleapis|RefererNotAllowed|ApiNotActivated|InvalidKey|ProjectDenied|Billing/i.test(t))show('window.error',t)});
  let n=0;const timer=setInterval(()=>{n++;const el=document.querySelector('.gm-err-message,.gm-err-container');if(el){show('Google map overlay',(el.innerText||el.textContent||'').trim()||'Google rendered an error overlay');clearInterval(timer)}else if(n>20)clearInterval(timer)},500);
})();</script>`;
const REFINE=`<script src="./refine.js?v=20260919-1335"></script>`;
self.addEventListener('fetch',e=>{
  if(e.request.method==='GET'&&e.request.mode==='navigate'){
    e.respondWith((async()=>{
      const r=await fetch(e.request,{cache:'no-store'});
      const ct=r.headers.get('content-type')||'';
      if(!ct.includes('text/html'))return r;
      let html=await r.text();
      if(!html.includes('__afieldMapsDebug'))html=html.replace('</body>',MAPS_DEBUG+'</body>');
      if(!html.includes('refine.js'))html=html.replace('</body>',REFINE+'</body>');
      const h=new Headers(r.headers);h.delete('content-length');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    })().catch(()=>fetch(e.request,{cache:'reload'})));
  }
});
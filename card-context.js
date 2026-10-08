(function(){
'use strict';
const STYLE='__afieldCardContextStyle';
function C(){try{return typeof window.C==='function'?window.C():(0,eval)('C()')}catch(e){return null}}
function norm(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,'')}
function activeDay(){const ey=document.querySelector('.brief .ey');const m=(ey?.textContent||'').match(/DAY\s*(\d+)/i);return m?Math.max(0,Number(m[1])-1):0}
function findItem(name){
 const c=C(),d=c?.plan?.days?.[activeDay()];if(!d)return null;
 for(const l of ['items','nearby','backup','utilities']){const x=(d[l]||[]).find(v=>norm(v.name)===norm(name));if(x)return x}
 return (c?.saved||[]).find(v=>v&&typeof v==='object'&&norm(v.name)===norm(name))||null;
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function styles(){
 if(document.getElementById(STYLE))return;
 const s=document.createElement('style');s.id=STYLE;
 s.textContent='.afContextTop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:-2px 0 10px}.afContextTime{font-size:12px;font-weight:900;letter-spacing:.05em;color:#986247}.afContextState{font-size:10px;font-weight:900;letter-spacing:.08em;border-radius:999px;padding:6px 9px;background:#efefeb;color:#666}.afContextState.done{background:#111;color:#fff}.afContextState.missed{background:#eee7e2;color:#986247}.afGuideBtn{border:1px solid #deded8;background:#fff;color:#111;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:850;margin-top:10px}.afFieldNotes{margin:14px 0 0;padding:13px 15px;border-radius:17px;background:#f7f7f4}.afFieldNotes b{display:block;font-size:10px;letter-spacing:.12em;margin-bottom:7px;color:#777}.afFieldNotes ul{margin:0;padding-left:18px}.afFieldNotes li{font-size:13px;line-height:1.5;margin:4px 0}.afSourceSheet{position:fixed;inset:0;z-index:2147483300;background:#0006;display:flex;align-items:flex-end;justify-content:center;padding:8px}.afSourceInner{width:min(720px,100%);max-height:80vh;overflow:auto;background:#fbfbf9;border-radius:30px 30px 18px 18px;padding:26px}.afSourceInner h2{font-size:28px;letter-spacing:-.04em;margin:8px 0 18px}.afSourceRow{padding:12px 0;border-top:1px solid #e5e5df}.afSourceRow small{display:block;color:#888;margin-bottom:4px}.afSourceRow a{color:#111;font-weight:800}.afSourceClose{width:100%;border:0;border-radius:999px;padding:14px;background:#111;color:#fff;font-weight:850;margin-top:18px}';
 document.head.appendChild(s);
}
function stateLabel(x,isNext){
 if(x?.completed)return['DONE','done'];
 if(x?.missed)return['MISSED','missed'];
 if(isNext)return['NEXT',''];
 return['PLANNED',''];
}
function noteItems(x){
 let v=x?.checklist||x?.fieldNotes||x?.todo||x?.thingsToDo||x?.tips;
 if(Array.isArray(v))return v.map(String).filter(Boolean).slice(0,4);
 if(typeof v==='string')return v.split(/\n|•|·/).map(s=>s.trim()).filter(Boolean).slice(0,4);
 return [];
}
function sourceModal(x){
 document.querySelector('.afSourceSheet')?.remove();
 const source=x?.source||x?.sourceType||'Saved by you',why=x?.why||'',address=x?.address||'',ig=x?.instagramUrl||x?.sourcePost||'',place=x?.placeId||'';
 const m=document.createElement('div');m.className='afSourceSheet';
 m.innerHTML='<div class="afSourceInner"><div class="ey">GUIDE / SOURCE</div><h2>'+esc(x?.name||'Place')+'</h2>'+
   '<div class="afSourceRow"><small>출처</small><b>'+esc(source)+'</b></div>'+
   (why?'<div class="afSourceRow"><small>왜 저장했나요?</small>'+esc(why)+'</div>':'')+
   (address?'<div class="afSourceRow"><small>주소</small>'+esc(address)+'</div>':'')+
   (place?'<div class="afSourceRow"><small>Google Place</small>연결됨 ✓</div>':'')+
   (ig?'<div class="afSourceRow"><small>원본</small><a href="'+esc(ig)+'" target="_blank" rel="noopener">Instagram / source 열기 ↗</a></div>':'')+
   '<button class="afSourceClose">닫기</button></div>';
 m.onclick=e=>{if(e.target===m)m.remove()};m.querySelector('.afSourceClose').onclick=()=>m.remove();document.body.appendChild(m);
}
function enhanceRouteCards(){
 const c=C(),d=c?.plan?.days?.[activeDay()];if(!d)return;
 const open=(d.items||[]).filter(x=>!x.completed&&!x.missed);const next=open[0];
 document.querySelectorAll('.routeCard').forEach(card=>{
   if(card.dataset.afContext==='1')return;
   const name=card.querySelector('h2')?.textContent?.trim();if(!name)return;
   const x=findItem(name);if(!x)return;card.dataset.afContext='1';
   const top=document.createElement('div');top.className='afContextTop';
   const time=x.arrivalTime||x.start||x.time||'시간 미정';const st=stateLabel(x,next&&norm(next.name)===norm(x.name));
   top.innerHTML='<span class="afContextTime">'+esc(time)+'</span><span class="afContextState '+st[1]+'">'+st[0]+'</span>';
   const h=card.querySelector('h2');card.insertBefore(top,h);
   const notes=noteItems(x);if(notes.length){
     const box=document.createElement('div');box.className='afFieldNotes';
     box.innerHTML='<b>ON SITE</b><ul>'+notes.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>';
     const intro=card.querySelector('.placeIntro');(intro||h).insertAdjacentElement('afterend',box);
   }
   const b=document.createElement('button');b.type='button';b.className='afGuideBtn';b.textContent='안내 / 출처';b.onclick=()=>sourceModal(x);
   const maps=card.querySelector('.afMapActions'),done=card.querySelector('.afDoneRow');
   if(maps)maps.insertAdjacentElement('afterend',b);else if(done)done.insertAdjacentElement('beforebegin',b);else card.appendChild(b);
 });
}
function enhanceMini(){
 document.querySelectorAll('.miniPlace,.utilityCard').forEach(card=>{
  if(card.dataset.afContext==='1')return;const name=card.querySelector('b')?.textContent?.replace(/^◎\s*/,'').trim();if(!name)return;
  const x=findItem(name);if(!x)return;card.dataset.afContext='1';
  const b=document.createElement('button');b.type='button';b.className='afGuideBtn';b.textContent='안내 / 출처';b.onclick=()=>sourceModal(x);card.appendChild(b);
 });
}
function inject(){styles();enhanceRouteCards();enhanceMini()}
const mo=new MutationObserver(()=>{clearTimeout(window.__afCtxT);window.__afCtxT=setTimeout(inject,70)});
mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(inject,120);setTimeout(inject,800);
window.AfieldCardContext={inject};
})();
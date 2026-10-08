(function(){
'use strict';
const STYLE='__afieldFootprintsStyle';
const ID='__afieldFootprints';
function C(){try{return typeof window.C==='function'?window.C():(0,eval)('C()')}catch(e){return null}}
function activeDay(){const ey=document.querySelector('.brief .ey');const m=(ey?.textContent||'').match(/DAY\s*(\d+)/i);return m?Math.max(0,Number(m[1])-1):0}
function coords(x){const lat=Number(x?.lat),lng=Number(x?.lng);return Number.isFinite(lat)&&Number.isFinite(lng)}
function styles(){
 if(document.getElementById(STYLE))return;
 const s=document.createElement('style');s.id=STYLE;
 s.textContent='.afFootWrap{margin:32px 0 12px;padding:22px;border:1px solid #deded8;border-radius:26px;background:linear-gradient(145deg,#fff,#f3f3ef)}.afFootHead{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.afFootHead h3{font-size:23px;letter-spacing:-.04em;margin:4px 0 5px}.afFootCount{white-space:nowrap;background:#111;color:#fff;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:850}.afFootList{display:flex;gap:7px;overflow:auto;padding:12px 0 4px}.afFootChip{white-space:nowrap;border:1px solid #dfdfda;background:#fff;border-radius:999px;padding:8px 10px;font-size:11px;font-weight:800}.afFootMap{height:270px;border-radius:22px;overflow:hidden;margin-top:14px;background:#e8e8e2}.afFootEmpty{padding:22px;text-align:center;color:#888;font-size:13px}@media(max-width:700px){.afFootWrap{padding:18px}.afFootMap{height:235px}}';
 document.head.appendChild(s);
}
function doneItems(){
 const c=C(),di=activeDay(),d=c?.plan?.days?.[di];
 if(!d)return [];
 return (d.items||[]).filter(x=>x.completed===true);
}
async function draw(list){
 const el=document.getElementById('__afieldFootprintsMap');if(!el)return;
 const pts=list.filter(coords);
 if(!pts.length){el.innerHTML='<div class="afFootEmpty">Done한 장소의 위치가 확인되면 여기에 오늘의 발자국이 생겨요 👣</div>';return}
 try{
   if(typeof window.renderAfieldMap==='function')await window.renderAfieldMap('__afieldFootprintsMap',pts,{numbered:true,route:true});
   else await (0,eval)("renderAfieldMap('__afieldFootprintsMap',window.__afieldFootprintPts,{numbered:true,route:true})");
 }catch(e){console.warn('Afield footprints map failed',e);el.innerHTML='<div class="afFootEmpty">발자국 지도를 불러오지 못했어요.</div>'}
}
function inject(){
 styles();
 const full=document.getElementById('dayGoogleMap');if(!full)return;
 const old=document.getElementById(ID);if(old)old.remove();
 const list=doneItems();window.__afieldFootprintPts=list;
 const wrap=document.createElement('section');wrap.id=ID;wrap.className='afFootWrap';
 wrap.innerHTML='<div class="afFootHead"><div><div class="ey">TODAY\'S FOOTPRINTS</div><h3>👣 오늘 내가 실제로 다녀온 길</h3><div class="small">Done한 장소만 남겨요. Missed와 아직 안 간 곳은 여기엔 들어오지 않아요.</div></div><span class="afFootCount">'+list.length+' DONE</span></div>'+
   (list.length?'<div class="afFootList">'+list.map((x,i)=>'<span class="afFootChip">✓ '+(i+1)+' · '+String(x.name||'Place').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))+'</span>').join('')+'</div>':'<div class="afFootEmpty">아직 Done한 장소가 없어요. 오늘 첫 발자국을 남겨봐요 👣</div>')+
   (list.length?'<div id="__afieldFootprintsMap" class="afFootMap"></div>':'');
 full.parentElement.insertBefore(wrap,full.nextSibling);
 if(list.length)setTimeout(()=>draw(list),80);
}
const mo=new MutationObserver(()=>{clearTimeout(window.__afFootT);window.__afFootT=setTimeout(inject,100)});
mo.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(inject,300);setTimeout(inject,900);
window.AfieldFootprints={inject};
})();
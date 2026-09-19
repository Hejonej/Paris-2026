(function(){
'use strict';
const API='https://travel-ai.luckyjungheywon.workers.dev';
const ID='__afieldRefineCard';
const STYLE_ID='__afieldRefineStyle';
const DEFAULT_PLACEHOLDER='예: 각 날짜에 하나의 테마가 있었으면 좋겠어. 하루는 힐링데이로 만들고, 마레 쇼핑날에는 Simple Rainbow에서 발레슈즈를 사고 싶어. 기존 MUST와 고정 일정은 유지해줘.';

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function current(){try{return typeof window.C==='function'?window.C():null}catch(e){return null}}
function persist(){try{if(typeof window.save==='function')window.save()}catch(e){}}
function tripDays(c){return Array.isArray(c?.plan?.days)?c.plan.days:[]}
function dateLabel(d){
  if(!d)return '';
  const x=new Date(d+'T12:00:00');
  if(Number.isNaN(x.getTime()))return String(d);
  return `${x.getMonth()+1}/${x.getDate()}`;
}
function normalizedItems(c){
  const out=[];
  for(const d of tripDays(c)) for(const x of (d.items||[])) if(x) out.push(x);
  for(const x of (c?.saved||[])) if(x&&typeof x!=='string'&&x.sourceType!=='instagram') out.push(x);
  const seen=new Set();
  return out.filter(x=>{const k=(x.placeId||x.name||'').toString().toLowerCase();if(!k||seen.has(k))return false;seen.add(k);return true});
}
function payload(c,request,verifyHours){
  return {
    trip:{title:c.title||'',city:c.city||'',country:c.country||'',start:c.start||'',end:c.end||'',stays:c.stays||[],transports:c.flights||[],brief:c.refineBrief||''},
    itinerary:tripDays(c).map((d,i)=>({day:i+1,date:d.date||'',theme:d.theme||'',items:(d.items||[]).map(x=>({name:x.name||'',placeId:x.placeId||'',priority:x.priority||'',routeLayer:x.routeLayer||'ROUTE',address:x.address||'',locked:!!x.locked,userEdited:!!x.userEdited}))})),
    places:normalizedItems(c).slice(0,260).map(x=>({name:x.name||'',placeId:x.placeId||'',address:x.address||'',priority:x.priority||'',category:x.category||x.primaryType||'',why:x.why||'',source:x.source||'',lat:x.lat??null,lng:x.lng??null})),
    request,
    protectMust:true,
    verifyHours:!!verifyHours
  };
}
function ensureStyle(){
 if(document.getElementById(STYLE_ID))return;
 const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
 #${ID}{border:1px solid #deded8;background:linear-gradient(145deg,#fff,#f4f4f0);border-radius:26px;padding:22px;margin:16px 0 20px}
 #${ID} .arTop{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
 #${ID} h2{font-size:28px;letter-spacing:-.045em;margin:6px 0 7px}
 #${ID} p{margin:0;color:#74746f;line-height:1.5;font-size:14px}
 #${ID} button{border:0;border-radius:999px;padding:12px 17px;font-weight:800;background:#111;color:#fff;white-space:nowrap}
 #${ID} .arSaved{margin-top:14px;padding-top:14px;border-top:1px solid #e1e1db;font-size:13px;color:#666}
 .arModal{position:fixed;inset:0;z-index:2147483000;background:#0007;display:flex;align-items:flex-end;justify-content:center;padding:8px}
 .arSheet{width:min(720px,100%);max-height:88vh;overflow:auto;background:#fbfbf9;border-radius:30px 30px 18px 18px;padding:26px;box-shadow:0 -18px 60px #0002}
 .arEy{font-size:11px;letter-spacing:.2em;font-weight:850;color:#888;text-transform:uppercase}
 .arSheet h2{font-size:30px;letter-spacing:-.045em;margin:8px 0 9px}
 .arSheet p{color:#777;line-height:1.5}
 .arTextarea{width:100%;min-height:210px;resize:vertical;border:1px solid #dcdcd6;background:#fff;border-radius:20px;padding:16px;font:16px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;outline:none}
 .arRow{display:flex;align-items:center;gap:9px;margin:12px 0;font-size:13px;color:#555}
 .arActions{display:flex;gap:9px;margin-top:18px}
 .arBtn{border:0;border-radius:999px;padding:14px 18px;font-weight:800;background:#e8e8e4}
 .arBtn.primary{background:#111;color:#fff;flex:1}
 .arSuggestion{border:1px solid #deded8;background:#fff;border-radius:20px;padding:15px;margin:10px 0;display:grid;grid-template-columns:22px 1fr;gap:11px}
 .arSuggestion b{display:block;margin-bottom:4px}.arMeta{font-size:11px;font-weight:800;letter-spacing:.08em;color:#888;margin-bottom:4px}.arReason{font-size:13px;color:#666;line-height:1.45}
 .arStatus{border-radius:18px;background:#efefeb;padding:14px;margin:13px 0;font-size:13px;color:#555;line-height:1.5}
 .arTheme{display:inline-flex;margin:8px 0 4px;border-radius:999px;background:#111;color:#fff;padding:7px 10px;font-size:11px;font-weight:800;letter-spacing:.04em}
 @media(min-width:761px){.arModal{align-items:center;padding:20px}.arSheet{border-radius:30px}}
 @media(max-width:620px){#${ID} .arTop{display:block}#${ID} button{margin-top:14px}.arSheet h2{font-size:27px}}
 `;document.head.appendChild(s);
}
function closeModal(){document.getElementById('__afieldRefineModal')?.remove()}
function modal(inner){closeModal();const m=document.createElement('div');m.id='__afieldRefineModal';m.className='arModal';m.innerHTML=`<div class="arSheet">${inner}</div>`;m.addEventListener('click',e=>{if(e.target===m)closeModal()});document.body.appendChild(m);return m}
function openComposer(){
 const c=current();if(!c)return;
 const prev=c.refineBrief||'';
 modal(`<div class="arEy">REFINE WITH AFIELD</div><h2>이 여행을 조금 더 나답게.</h2><p>지금 일정은 유지한 채, 바꾸고 싶은 분위기·우선순위·하고 싶은 일을 말해줘요. Afield가 먼저 변경안을 보여줘요.</p><textarea id="arRequest" class="arTextarea" placeholder="${esc(DEFAULT_PLACEHOLDER)}">${esc(prev)}</textarea><label class="arRow"><input id="arHours" type="checkbox" checked> 영업시간이 중요한 변경은 확인하기</label><div class="arActions"><button class="arBtn" id="arCancel">취소</button><button class="arBtn primary" id="arAsk">변경안 보기</button></div>`);
 document.getElementById('arCancel').onclick=closeModal;
 document.getElementById('arAsk').onclick=askAfield;
}
async function askAfield(){
 const c=current();const q=document.getElementById('arRequest')?.value.trim();if(!c||!q)return;
 const verify=!!document.getElementById('arHours')?.checked;
 modal(`<div class="arEy">REFINE WITH AFIELD</div><h2>현재 여행을 읽고 있어요.</h2><div class="arStatus">기존 일정과 MUST를 보존하면서, 요청한 테마와 장소를 어디에 자연스럽게 넣을지 비교 중이에요.</div>`);
 try{
   const r=await fetch(API+'/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload(c,q,verify))});
   const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.detail||data.error||('HTTP '+r.status));
   const list=Array.isArray(data.suggestions)?data.suggestions:[];
   c._pendingRefine={request:q,suggestions:list,createdAt:new Date().toISOString()};persist();
   showReview(c._pendingRefine);
 }catch(e){
   modal(`<div class="arEy">REFINE WITH AFIELD</div><h2>변경안을 만들지 못했어요.</h2><div class="arStatus">${esc(e.message||e)}</div><div class="arActions"><button class="arBtn" onclick="document.getElementById('__afieldRefineModal').remove()">닫기</button><button class="arBtn primary" id="arRetry">다시 쓰기</button></div>`);document.getElementById('arRetry').onclick=openComposer;
 }
}
function showReview(p){
 const list=p?.suggestions||[];
 const html=list.length?list.map((s,i)=>`<label class="arSuggestion"><input type="checkbox" class="arPick" data-i="${i}" ${s.selected===false?'':'checked'}><div><div class="arMeta">${esc(s.type||'CHANGE')}${s.hours_status&&s.hours_status!=='not_checked'?' · '+esc(s.hours_status):''}</div><b>${esc(s.action||'')}</b><div class="arReason">${esc(s.reason||'')}${s.hours_note?'<br>'+esc(s.hours_note):''}</div></div></label>`).join(''):`<div class="arStatus">제안된 변경이 없어요. 요청을 조금 더 구체적으로 써봐요.</div>`;
 modal(`<div class="arEy">SUGGESTED CHANGES</div><h2>${list.length}개의 변경안을 만들었어요.</h2><p>체크한 변경만 적용을 시도해요. 장소와 날짜가 명확하게 연결되는 변경만 자동 반영하고, 애매한 제안은 여행 방향으로 저장해둬요.</p>${html}<div class="arActions"><button class="arBtn" id="arBack">다시 쓰기</button><button class="arBtn primary" id="arApply">선택한 변경 적용</button></div>`);
 document.getElementById('arBack').onclick=openComposer;document.getElementById('arApply').onclick=applySelected;
}
function targetDayIndex(action,c){
 const s=String(action||'');let m=s.match(/(?:DAY|Day|day)\s*(\d+)/);if(m){const n=Number(m[1])-1;if(n>=0&&n<tripDays(c).length)return n}
 m=s.match(/\b(\d{1,2})\/(\d{1,2})\b/);if(m){const md=`${Number(m[1])}/${Number(m[2])}`;const i=tripDays(c).findIndex(d=>dateLabel(d.date)===md);if(i>=0)return i}
 return -1;
}
function findPlaceByAction(action,c){
 const a=String(action||'').toLowerCase();const pool=normalizedItems(c).filter(x=>x?.name);
 return pool.sort((x,y)=>String(y.name).length-String(x.name).length).find(x=>a.includes(String(x.name).toLowerCase()))||null;
}
function findItemLocation(place,c){
 if(!place)return null;const key=(place.placeId||place.name||'').toString().toLowerCase();
 for(let di=0;di<tripDays(c).length;di++){
   const arr=tripDays(c)[di].items||[];const ix=arr.findIndex(x=>((x.placeId||x.name||'').toString().toLowerCase()===key));if(ix>=0)return {di,ix,item:arr[ix]};
 }return null;
}
function applyOne(s,c){
 const type=String(s.type||'').toUpperCase(),action=s.action||'',di=targetDayIndex(action,c),place=findPlaceByAction(action,c),loc=findItemLocation(place,c);
 if(type==='RHYTHM'&&di>=0){tripDays(c)[di].theme=String(action).replace(/^(?:DAY|Day|day)\s*\d+\s*[-:·]?\s*/,'').trim();return true}
 if(type==='ADD'&&di>=0&&place&&!loc){const d=tripDays(c)[di];d.items=d.items||[];d.items.push({...place,userEdited:true,locked:false,routeLayer:'ROUTE'});return true}
 if(type==='MOVE'&&di>=0&&loc&&loc.di!==di){const [item]=tripDays(c)[loc.di].items.splice(loc.ix,1);item.userEdited=true;tripDays(c)[di].items=tripDays(c)[di].items||[];tripDays(c)[di].items.push(item);return true}
 if(type==='DROP'&&loc&&String(loc.item?.priority||place?.priority||'').toUpperCase()!=='MUST'){tripDays(c)[loc.di].items.splice(loc.ix,1);return true}
 return false;
}
function applySelected(){
 const c=current();if(!c||!c._pendingRefine)return;
 const picks=[...document.querySelectorAll('.arPick:checked')].map(x=>Number(x.dataset.i)).filter(Number.isFinite);
 const chosen=picks.map(i=>c._pendingRefine.suggestions[i]).filter(Boolean);
 let applied=0;for(const s of chosen)if(applyOne(s,c))applied++;
 c.refineBrief=c._pendingRefine.request;
 c.refineGuidance=chosen;
 c.refineUpdatedAt=new Date().toISOString();
 delete c._pendingRefine;persist();closeModal();
 try{if(typeof window.chapter==='function')window.chapter()}catch(e){}
 setTimeout(()=>{modal(`<div class="arEy">REFINED</div><h2>${applied}개 변경을 일정에 바로 반영했어요.</h2><div class="arStatus">나머지 ${Math.max(0,chosen.length-applied)}개는 애매하게 추측하지 않고 여행 방향으로 저장했어요. Trip의 Edit itinerary에서 직접 조정할 수도 있어요.</div><div class="arActions"><button class="arBtn primary" id="arDone">일정 보기</button></div>`);document.getElementById('arDone').onclick=closeModal},80);
}
function injectTheme(){
 const c=current();if(!c)return;const brief=document.querySelector('.brief');if(!brief||brief.querySelector('.arTheme'))return;
 const ey=brief.querySelector('.ey');const m=(ey?.textContent||'').match(/DAY\s*(\d+)/i);if(!m)return;const theme=tripDays(c)[Number(m[1])-1]?.theme;if(theme){const x=document.createElement('div');x.className='arTheme';x.textContent=theme;ey.insertAdjacentElement('afterend',x)}
}
function inject(){
 ensureStyle();const c=current();if(!c)return;
 const tabs=[...document.querySelectorAll('.tabs')].find(t=>[...t.querySelectorAll('button')].some(b=>b.classList.contains('on')&&b.textContent.trim()==='Trip'));
 if(!tabs){return}
 if(!document.getElementById(ID)){
   const card=document.createElement('div');card.id=ID;
   const saved=Array.isArray(c.refineGuidance)&&c.refineGuidance.length?`<div class="arSaved">Last refined · ${c.refineGuidance.length} saved changes</div>`:'';
   card.innerHTML=`<div class="arTop"><div><div class="arEy">REFINE WITH AFIELD</div><h2>Make this trip more you.</h2><p>이미 만든 일정 위에서 분위기, 테마, 사고 싶은 것, 하고 싶은 경험을 말해줘요. 먼저 변경안을 보여줄게요.</p></div><button type="button">Refine this trip</button></div>${saved}`;
   card.querySelector('button').onclick=openComposer;tabs.insertAdjacentElement('afterend',card);
 }
 injectTheme();
}
const mo=new MutationObserver(()=>{clearTimeout(window.__afieldRefineT);window.__afieldRefineT=setTimeout(inject,40)});mo.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',()=>setTimeout(inject,120));setTimeout(inject,200);
})();

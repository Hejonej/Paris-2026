(function(){
'use strict';
function current(){try{return typeof window.C==='function'?window.C():null}catch(e){return null}}
function days(c){return Array.isArray(c?.plan?.days)?c.plan.days:[]}
function norm(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,'')}
function key(x){return String(x?.placeId||norm(x?.name||''))}
function persist(){try{(0,eval)('save()')}catch(e){try{console.warn('Afield persist fallback failed',e)}catch(_){}}}
function rerender(){try{if(typeof window.chapter==='function')window.chapter();else (0,eval)('chapter()')}catch(e){console.warn('Afield rerender failed',e)}}
function allPlaces(c){const out=[];for(const d of days(c)){for(const layer of ['items','nearby','backup'])for(const x of (d[layer]||[]))out.push(x)}for(const x of (c?.saved||[]))if(x&&typeof x==='object'&&x.sourceType!=='instagram')out.push(x);const seen=new Set();return out.filter(x=>{const k=key(x);if(!k||seen.has(k))return false;seen.add(k);return true})}
function canonicalType(s){
 let raw=String(s?.type||s?.kind||s?.operation||s?.actionType||'').toUpperCase().replace(/[\s-]+/g,'_');
 const text=[raw,s?.action,s?.summary,s?.title].filter(Boolean).join(' ').toUpperCase();
 if(/THEME|RHYTHM|CHARACTER/.test(text))return 'THEME';
 if(/MOVE_PLACE|RESCHEDULE|RELOCATE|MOVE\b|SHIFT/.test(text))return 'MOVE';
 if(/ADD_PLACE|INSERT|INCLUDE|ADD\b/.test(text))return 'ADD';
 if(/REMOVE_PLACE|DROP_PLACE|DELETE|REMOVE|DROP/.test(text))return 'DROP';
 if(/SET_LAYER|MOVE_LAYER|ROUTE_LAYER|NEARBY|BACKUP/.test(text))return 'LAYER';
 if(/SET_PRIORITY|PRIORITY|MARK_MUST|ANCHOR|MUST/.test(text))return 'PRIORITY';
 return raw||'CHANGE';
}
function numDay(v,c){
 if(v==null||v==='')return -1;
 if(Number.isInteger(v)&&v>=0&&v<days(c).length)return v;
 const n=Number(v);if(Number.isFinite(n)&&n>=1&&n<=days(c).length)return n-1;
 const text=String(v);
 let m=text.match(/(?:day\s*)?(\d+)/i);if(m){const x=Number(m[1])-1;if(x>=0&&x<days(c).length)return x}
 const iso=text.match(/\d{4}-\d{2}-\d{2}/)?.[0];if(iso){const i=days(c).findIndex(d=>String(d.date||d.iso||'').slice(0,10)===iso);if(i>=0)return i}
 let md=text.match(/\b(\d{1,2})\/(\d{1,2})\b/);if(md){const want=`${Number(md[1])}/${Number(md[2])}`;const i=days(c).findIndex(d=>{const raw=String(d.date||d.iso||'');const dt=new Date(raw+'T12:00:00');return !Number.isNaN(dt.getTime())&&`${dt.getMonth()+1}/${dt.getDate()}`===want});if(i>=0)return i}
 return -1;
}
function targetDay(s,c){for(const v of [s?.targetDay,s?.toDay,s?.day,s?.dayIndex,s?.targetDate,s?.date]){const i=numDay(v,c);if(i>=0)return i}const text=[s?.action,s?.summary,s?.title,s?.reason].filter(Boolean).join(' ');return numDay(text,c)}
function placeQuery(s){const p=s?.place;if(typeof p==='string')return p;if(p&&typeof p==='object')return p.name||p.placeName||'';return s?.placeName||s?.name||s?.targetPlace||s?.target||s?.venue||''}
function findPlace(s,c){const q=norm(placeQuery(s));const text=norm([s?.action,s?.summary,s?.title,s?.reason].filter(Boolean).join(' '));const list=allPlaces(c).sort((a,b)=>String(b.name||'').length-String(a.name||'').length);return list.find(x=>q&&norm(x.name)===q)||list.find(x=>q&&norm(x.name).includes(q))||list.find(x=>text&&text.includes(norm(x.name)))||null}
function findLoc(place,c){if(!place)return null;const k=key(place);for(let di=0;di<days(c).length;di++)for(const layer of ['items','nearby','backup']){const a=days(c)[di][layer]||[];const ix=a.findIndex(x=>key(x)===k||norm(x.name)===norm(place.name));if(ix>=0)return {di,layer,ix,item:a[ix]}}return null}
function layerName(s){const raw=String(s?.targetLayer||s?.destinationLayer||s?.layer||s?.routeLayer||'').toUpperCase();if(raw.includes('NEAR'))return 'nearby';if(raw.includes('BACK'))return 'backup';return 'items'}
function themeText(s){return String(s?.theme||s?.newTheme||s?.value||s?.title||s?.action||'').replace(/^(?:SET\s+)?(?:DAY\s*\d+\s*)?(?:THEME)?\s*[-:·]?\s*/i,'').trim()}
function applyOne(s,c){
 const type=canonicalType(s),di=targetDay(s,c),place=findPlace(s,c),loc=findLoc(place,c),layer=layerName(s);
 if(type==='THEME'&&di>=0){const t=themeText(s);if(!t)return {ok:false,why:'theme missing'};days(c)[di].theme=t;return {ok:true}}
 if(type==='ADD'){if(di<0)return {ok:false,why:'day missing'};if(!place)return {ok:false,why:'place not found'};if(loc)return {ok:false,why:'already in itinerary'};days(c)[di][layer]=days(c)[di][layer]||[];days(c)[di][layer].push({...place,userEdited:true,routeLayer:layer==='items'?'ROUTE':layer.toUpperCase()});return {ok:true}}
 if(type==='MOVE'||type==='LAYER'){if(di<0)return {ok:false,why:'day missing'};if(!loc)return {ok:false,why:'place not found in itinerary'};if(loc.item.locked)return {ok:false,why:'locked'};const [x]=days(c)[loc.di][loc.layer].splice(loc.ix,1);x.userEdited=true;x.routeLayer=layer==='items'?'ROUTE':layer.toUpperCase();days(c)[di][layer]=days(c)[di][layer]||[];days(c)[di][layer].push(x);return {ok:true}}
 if(type==='DROP'){if(!loc)return {ok:false,why:'place not found in itinerary'};if(loc.item.locked)return {ok:false,why:'locked'};if(String(loc.item.priority||'').toUpperCase()==='MUST')return {ok:false,why:'MUST protected'};days(c)[loc.di][loc.layer].splice(loc.ix,1);return {ok:true}}
 if(type==='PRIORITY'){if(!place)return {ok:false,why:'place not found'};const val=String(s?.priority||s?.value||'MUST').toUpperCase();const targets=allPlaces(c).filter(x=>key(x)===key(place)||norm(x.name)===norm(place.name));for(const x of targets){x.priority=val;x.userEdited=true}return {ok:true}}
 return {ok:false,why:'unsupported '+type};
}
function selectedSuggestions(c){const pending=c?._pendingRefine;if(!pending)return [];const boxes=[...document.querySelectorAll('.rvPick')];if(!boxes.length)return pending.suggestions||[];return boxes.filter(x=>x.checked).map(x=>(pending.suggestions||[])[Number(x.dataset.i)]).filter(Boolean)}
function showResult(applied,failed){
 const modal=document.getElementById('__afieldRefineModalV2');if(!modal)return;
 const sheet=modal.querySelector('.rvSheet');if(!sheet)return;
 sheet.innerHTML=`<div class="rvEy">REFINED</div><h2>${applied}개 변경을 반영했어요.</h2><div class="rvStatus">${failed.length?`${failed.length}개는 자동 적용하지 못했어요. 잠금·MUST 보호·장소 매칭 여부를 유지했어요.`:'선택한 변경이 itinerary에 저장됐어요.'}</div><div class="rvActions"><button class="rvBtn primary" id="rvApplyDone">일정에서 확인</button></div>`;
 document.getElementById('rvApplyDone').onclick=()=>{modal.remove();rerender()};
}
function applySelectedFixed(e){
 const btn=e.target.closest?.('#rvApply');if(!btn)return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 const c=current();if(!c||!c._pendingRefine)return;
 const chosen=selectedSuggestions(c);
 c.refineUndo={plan:JSON.parse(JSON.stringify(c.plan||null)),saved:JSON.parse(JSON.stringify(c.saved||[])),buyList:JSON.parse(JSON.stringify(c.buyList||[])),at:new Date().toISOString()};
 let applied=0;const failed=[];for(const s of chosen){const r=applyOne(s,c);if(r.ok)applied++;else failed.push({s,why:r.why})}
 c.refineBrief=c._pendingRefine.request;c.refineGuidance=chosen;c.refineApplyReport={applied,failed:failed.map(x=>({label:x.s?.action||x.s?.summary||x.s?.title||x.s?.placeName||'Change',reason:x.why})),at:new Date().toISOString()};c.refineUpdatedAt=new Date().toISOString();delete c._pendingRefine;
 persist();rerender();
 setTimeout(()=>showResult(applied,failed),60);
}
document.addEventListener('click',applySelectedFixed,true);
window.AfieldRefineApplyFix={applyOne,canonicalType};
})();

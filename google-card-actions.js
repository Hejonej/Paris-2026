(function(){
'use strict';
const STYLE='__afieldGoogleCardStyle';
function C(){try{return typeof window.C==='function'?window.C():(0,eval)('C()')}catch(e){return null}}
function norm(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,'')}
function allPlaces(c){
  const out=[];
  for(const d of (c?.plan?.days||[])) for(const layer of ['items','nearby','backup','utilities']) for(const x of (d?.[layer]||[])) out.push(x);
  for(const x of (c?.saved||[])) if(x&&typeof x==='object'&&x.sourceType!=='instagram') out.push(x);
  const seen=new Set();
  return out.filter(x=>{const k=x.placeId||norm(x.name);if(!k||seen.has(k))return false;seen.add(k);return true});
}
function findPlace(name){
  const c=C(); if(!c)return null;
  const n=norm(name), list=allPlaces(c);
  return list.find(x=>norm(x.name)===n)||list.find(x=>norm(x.name).includes(n)||n.includes(norm(x.name)))||null;
}

function dirUrl(x,name){
  let dest='';
  if(Number.isFinite(Number(x?.lat))&&Number.isFinite(Number(x?.lng)))dest=x.lat+','+x.lng;
  else dest=x?.address||x?.name||name||'';
  let u='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest);
  if(x?.placeId)u+='&destination_place_id='+encodeURIComponent(x.placeId);
  return u;
}
function styles(){
  if(document.getElementById(STYLE))return;
  const s=document.createElement('style');s.id=STYLE;
  s.textContent='.afMapActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.afMapBtn{display:inline-flex;align-items:center;gap:6px;text-decoration:none;border:1px solid #deded8;background:#fff;color:#111;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:850;line-height:1}.afMapBtn.primary{background:#111;color:#fff;border-color:#111}.afMapBtn:active{transform:scale(.97)}.miniPlace .afMapActions,.utilityCard .afMapActions{margin-top:10px}';
  document.head.appendChild(s);
}
function cardName(card){
  if(card.classList.contains('routeCard'))return card.querySelector('h2')?.textContent?.trim()||'';
  return card.querySelector('b')?.textContent?.replace(/^◎\s*/,'').trim()||'';
}
function injectCard(card){
  if(card.querySelector(':scope > .afMapActions'))return;
  const name=cardName(card);if(!name)return;
  const x=findPlace(name)||{name};
  const wrap=document.createElement('div');wrap.className='afMapActions';
  const dir=document.createElement('a');dir.className='afMapBtn primary';dir.target='_blank';dir.rel='noopener';dir.href=dirUrl(x,name);dir.textContent='↗ 길찾기';
  wrap.append(dir);card.appendChild(wrap);
}
function inject(){
  styles();
  document.querySelectorAll('.routeCard,.miniPlace,.utilityCard').forEach(injectCard);
}
const mo=new MutationObserver(()=>{clearTimeout(window.__afMapCardT);window.__afMapCardT=setTimeout(inject,60)});
mo.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(inject,100);setTimeout(inject,700);
window.AfieldGoogleCardActions={inject};
})();
(function(){
'use strict';
const FLAG='instagramSourceRematchV2';
function C(){try{return typeof window.C==='function'?window.C():null}catch(e){return null}}
function save(){try{if(typeof window.save==='function')window.save()}catch(e){}}
function norm(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/&/g,'and').replace(/[^\p{L}\p{N}]+/gu,'')}
function words(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(/\s+/).filter(x=>x.length>1&&!['paris','france','cafe','café','restaurant','brunch','shop','store','louvre'].includes(x))}
function sim(a,b){const na=norm(a),nb=norm(b);if(!na||!nb)return 0;if(na===nb)return 1;if(na.length>=5&&nb.length>=5&&(na.includes(nb)||nb.includes(na)))return .9;const A=new Set(words(a)),B=new Set(words(b));if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/Math.max(A.size,B.size)}
function postUrl(p){return p?.source||p?.instagramUrl||p?.url||''}
function candidateObj(c){return typeof c==='string'?{name:c,confidence:'medium'}:(c||{})}
function inspirations(c){return (c?.saved||[]).filter(p=>p&&typeof p==='object'&&p.sourceType==='instagram'&&/^https?:\/\//.test(postUrl(p)))}
function igPlaces(c){return (c?.saved||[]).filter(p=>p&&typeof p==='object'&&p.sourceType==='instagram-place'&&p.name)}
function bestSourceFor(place,posts){
 const hits=[];
 posts.forEach((post,pi)=>{
   (post.candidates||[]).forEach((raw,ci)=>{
     const cand=candidateObj(raw),score=sim(place.extractedName||place.originalCandidateName||place.name,cand.name||'');
     if(score>=.72)hits.push({score,post,pi,ci,cand});
   });
 });
 hits.sort((a,b)=>b.score-a.score);
 if(!hits.length)return null;
 const best=hits[0],second=hits[1];
 if(best.score<.82)return null;
 if(second&&second.score>=best.score-.05&&postUrl(second.post)!==postUrl(best.post))return null;
 return best;
}
function propagate(c,place,url){
 const key=place.placeId||norm(place.name);let n=0;
 for(const d of (c.plan?.days||[]))for(const layer of ['items','nearby','backup'])for(const x of (d[layer]||[])){
   const same=place.placeId&&x.placeId?place.placeId===x.placeId:norm(x.name)===norm(place.name);
   if(!same)continue;
   if(x.instagramUrl!==url){x.instagramUrl=url;n++}
   x.source='Instagram · Saved by you';
   x.sourcePost=place.sourcePost||x.sourcePost||'';
 }
 return n;
}
function rematch(){
 const c=C();if(!c)return {checked:0,corrected:0,unchanged:0,ambiguous:0};
 const posts=inspirations(c),places=igPlaces(c);let corrected=0,unchanged=0,ambiguous=0,propagated=0;
 for(const p of places){
   const best=bestSourceFor(p,posts);
   if(!best){ambiguous++;continue}
   const url=postUrl(best.post);if(!url){ambiguous++;continue}
   if(p.source!==url||p.instagramUrl!==url){
     p.source=url;p.instagramUrl=url;p.sourcePost=best.post.name||best.post.sourcePost||p.sourcePost||'';
     p.sourcePostId=best.post.id||best.post.postId||best.post.shortcode||'';
     p.sourceCandidateIndex=best.ci;p.sourceCandidateName=best.cand.name||'';
     p.sourceConfidence='rematched_high';p.sourceRematchedAt=new Date().toISOString();corrected++;
   }else unchanged++;
   propagated+=propagate(c,p,url);
 }
 c[FLAG]={checked:places.length,corrected,unchanged,ambiguous,propagated,at:new Date().toISOString()};
 if(corrected||propagated){save();try{if(typeof window.chapter==='function')window.chapter()}catch(e){}}
 return c[FLAG];
}
setTimeout(rematch,700);
window.AfieldInstagramSourceRematch={run:rematch};
})();
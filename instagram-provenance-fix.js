(function(){
'use strict';
// Afield Instagram provenance guard.
// Principle: an itinerary place may show an Instagram source only when that source is explicitly traceable to the same extracted candidate.

function isHttp(u){return /^https?:\/\//i.test(String(u||''))}
function norm(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,'')}
function current(){try{return typeof window.C==='function'?window.C():null}catch(e){return null}}
function persist(){try{if(typeof window.save==='function')window.save()}catch(e){}}

function evidenceForSavedPlace(p){
 if(!p||typeof p==='string'||p.sourceType!=='instagram-place')return null;
 const url=isHttp(p.instagramUrl)?p.instagramUrl:(isHttp(p.source)?p.source:'');
 if(!url)return null;
 return {
   url,
   sourcePost:p.sourcePost||'',
   sourcePostId:p.sourcePostId||'',
   sourceCandidateIndex:Number.isInteger(p.sourceCandidateIndex)?p.sourceCandidateIndex:null,
   confidence:p.sourceConfidence||p.matchConfidence||'',
   extractedName:p.extractedName||p.originalCandidateName||p.sourceCandidateName||p.name||'',
   currentName:p.name||''
 };
}

function identityStillMatches(ev,p){
 const a=norm(ev.extractedName),b=norm(p?.name);
 if(!a||!b)return false;
 if(a===b)return true;
 // Small Google normalization differences are okay, but never allow a loose substring shorter than 6 chars.
 return a.length>=6&&b.length>=6&&(a.includes(b)||b.includes(a));
}

function sourceIsTrusted(ev,p){
 if(!ev||!isHttp(ev.url))return false;
 if(ev.confidence==='user_confirmed'||ev.confidence==='high')return identityStillMatches(ev,p);
 // Legacy records have no explicit confidence. Keep only if there is explicit candidate lineage and identity still matches.
 if(ev.sourcePostId&&ev.sourceCandidateIndex!==null)return identityStillMatches(ev,p);
 return false;
}

function sanitizePlace(p){
 if(!p||typeof p!=='object')return false;
 if(!p.instagramUrl)return false;
 const ev=evidenceForSavedPlace(p);
 if(sourceIsTrusted(ev,p))return false;
 p.instagramUrl='';
 p.instagramLinkSuppressed=true;
 p.instagramLinkSuppressedReason='unverified_source_provenance';
 return true;
}

function sourceMap(c){
 const m=new Map();
 for(const p of (c?.saved||[])){
   if(!p||typeof p==='string'||p.sourceType!=='instagram-place')continue;
   const key=p.placeId?('pid:'+p.placeId):('name:'+norm(p.name));
   if(key)m.set(key,p);
 }
 return m;
}

function sanitize(){
 const c=current();if(!c)return;
 const sm=sourceMap(c);let changed=0;
 // Sanitize saved places first.
 for(const p of (c.saved||[]))if(sanitizePlace(p))changed++;
 // Then sanitize itinerary layers against their canonical saved-place provenance.
 for(const d of (c.plan?.days||[])){
   for(const layer of ['items','nearby','backup']){
     for(const x of (d[layer]||[])){
       if(!x||typeof x!=='object'||!x.instagramUrl)continue;
       const key=x.placeId?('pid:'+x.placeId):('name:'+norm(x.name));
       const src=sm.get(key);
       const ev=src?evidenceForSavedPlace(src):null;
       if(!src||!sourceIsTrusted(ev,src)){
         x.instagramUrl='';x.instagramLinkSuppressed=true;x.instagramLinkSuppressedReason='unverified_source_provenance';changed++;
       }else if(x.instagramUrl!==ev.url){
         x.instagramUrl=ev.url;changed++;
       }
     }
   }
 }
 if(changed){c.instagramProvenanceFixedAt=new Date().toISOString();persist();try{if(typeof window.chapter==='function')window.chapter()}catch(e){}}
}

// Run after app state is restored and after future re-renders/imports.
setTimeout(sanitize,250);
const mo=new MutationObserver(()=>{clearTimeout(window.__afieldIgProvT);window.__afieldIgProvT=setTimeout(sanitize,120)});
mo.observe(document.documentElement,{childList:true,subtree:true});
window.AfieldInstagramProvenance={sanitize};
})();

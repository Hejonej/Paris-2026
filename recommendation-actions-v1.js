(function (root) {
  'use strict';
  // Afield Recommendation Actions v1: independent draft-only library.
  // This module deliberately never writes localStorage or modifies Afield state.
  const norm = v => String(v == null ? '' : v).normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const key = p => p && (p.placeId ? 'id:'+p.placeId : 'name:'+norm(p.name)+'|'+norm(p.address||''));
  const copy = x => JSON.parse(JSON.stringify(x));
  function validatePlace(p) {
    if (!p || !String(p.name||'').trim()) throw new Error('PLACE_NAME_REQUIRED');
    if (!p.placeId && !String(p.address||'').trim()) throw new Error('PLACE_ID_OR_ADDRESS_REQUIRED');
  }
  function isInPlan(trip, p) {
    const k=key(p);
    return (trip.plan?.days||[]).some(d=>['items','nearby','backup'].some(layer=>(d[layer]||[]).some(q=>key(q)===k)));
  }
  function inCandidates(trip,p) {return (trip.recommendationCandidates||[]).some(q=>key(q)===key(p));}
  function prepareAction(trip, action) {
    if (!trip || !action || !['ADD_CANDIDATE','SCHEDULE'].includes(action.type)) throw new Error('INVALID_ACTION');
    validatePlace(action.place);
    if (isInPlan(trip,action.place)) throw new Error('ALREADY_IN_PLAN');
    if (action.type==='ADD_CANDIDATE' && inCandidates(trip,action.place)) throw new Error('ALREADY_CANDIDATE');
    if(action.type==='SCHEDULE'){
      const days=trip.plan?.days||[];
      if(!Number.isInteger(action.dayIndex)||!days[action.dayIndex]) throw new Error('INVALID_DAY');
      if(!['items','nearby','backup'].includes(action.layer||'items')) throw new Error('INVALID_LAYER');
      // Availability, route feasibility and fixed-event conflicts require external checks.
      if(action.verified !== true) throw new Error('VERIFICATION_REQUIRED');
    }
    return {type:action.type,place:copy(action.place),dayIndex:action.dayIndex,layer:action.layer||'items'};
  }
  function applyApproved(trip, action) {
    const prepared=prepareAction(trip,action);
    const next=copy(trip), undo=copy(trip);
    const p={...prepared.place,sourceType:prepared.place.sourceType||'recommendation',userEdited:true};
    if(prepared.type==='ADD_CANDIDATE'){
      next.recommendationCandidates=next.recommendationCandidates||[];
      next.recommendationCandidates.push({...p,candidateStatus:'UNSCHEDULED'});
    } else {
      const day=next.plan.days[prepared.dayIndex];
      day[prepared.layer]=day[prepared.layer]||[];
      day[prepared.layer].push({...p,routeLayer:prepared.layer==='items'?'ROUTE':prepared.layer.toUpperCase()});
      next.recommendationCandidates=(next.recommendationCandidates||[]).filter(x=>key(x)!==key(p));
    }
    return {next, undo, event:{type:prepared.type,placeKey:key(p),approved:true}};
  }
  function cta(context) {
    if(context==='fill_slot') return {primary:'이 시간에 추가',secondary:'여행 후보에 추가'};
    if(context==='explore') return {primary:'여행 후보에 추가',secondary:'일정에 추가'};
    return {primary:'일정에 추가',secondary:'여행 후보에 추가'};
  }
  const api={key,isInPlan,inCandidates,prepareAction,applyApproved,cta};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.AfieldRecommendationActionsV1=api;
})(typeof globalThis!=='undefined'?globalThis:this);

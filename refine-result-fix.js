(function(){
'use strict';
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function current(){try{return typeof window.C==='function'?window.C():(0,eval)('C()')}catch(e){return null}}
function suggestionLabel(s){return s?.action||s?.summary||s?.title||s?.placeName||s?.name||'변경 제안'}
function humanReason(r){const m={
 'locked':'잠금된 일정이라 유지했어요.',
 'MUST protected':'MUST 일정이라 보호했어요.',
 'place not found':'현재 Places에서 정확한 장소를 찾지 못했어요.',
 'place not found in itinerary':'현재 일정에서 정확한 장소를 찾지 못했어요.',
 'day missing':'어느 날짜에 적용할지 확실하지 않았어요.',
 'theme missing':'테마 문구를 확정하지 못했어요.',
 'already in itinerary':'이미 일정에 들어가 있어요.'
};return m[r]||r||'정확하게 적용할 수 없어 기존 일정을 유지했어요.'}
function render(){
 const modal=document.getElementById('__afieldRefineModalV2');
 const sheet=modal?.querySelector('.rvSheet');
 const c=current(),report=c?.refineApplyReport;
 if(!sheet||!report||!sheet.querySelector('.rvEy')||sheet.querySelector('.rvEy')?.textContent.trim()!=='REFINED')return;
 if(sheet.dataset.resultFixed==='1')return;sheet.dataset.resultFixed='1';
 const approved=Number(report.approved ?? (c.refineGuidance||[]).length ?? 0);
 const appliedOps=Number(report.applied||0);
 const failedOps=Array.isArray(report.failed)?report.failed:[];
 const guidance=Array.isArray(c.refineGuidance)?c.refineGuidance:[];
 // We cannot reliably map legacy compiled ops 1:1 to suggestions, so never claim failedOps are failed suggestions.
 // The user-facing count stays anchored to what the user approved.
 const changedLabels=[];
 // Best-effort infer successful visible changes from current themes / guidance text.
 guidance.forEach(s=>{
   const label=suggestionLabel(s);
   if(label && changedLabels.length<appliedOps && !changedLabels.includes(label))changedLabels.push(label);
 });
 const unresolvedCount=Math.max(0,approved-Math.min(appliedOps,approved));
 const failedList=failedOps.slice(0,8).map(x=>`<li><b>${esc(x.label||'변경')}</b><div>${esc(humanReason(x.reason))}</div></li>`).join('');
 const successList=changedLabels.length?`<div class="rrSection"><div class="rrTitle">반영된 변경</div><ul>${changedLabels.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'';
 const unresolved=`<div class="rrSection"><div class="rrTitle">확인이 필요한 변경</div><p>${unresolvedCount}개 승인 항목은 자동으로 완전히 반영됐다고 확인할 수 없어요.${failedOps.length?' 아래는 실행 단계에서 막힌 이유예요.':''}</p>${failedList?`<ul>${failedList}</ul>`:''}</div>`;
 sheet.innerHTML=`<div class="rvEy">REFINED</div><h2>${approved}개 중 ${Math.min(appliedOps,approved)}개를 자동 반영했어요.</h2><div class="rvStatus">승인한 제안 수를 기준으로 표시해요. AI가 내부적으로 한 제안을 여러 실행 명령으로 나눠도 숫자를 중복 집계하지 않아요.</div>${successList}${unresolved}<div class="rvActions"><button class="rvBtn primary" id="rrDone">일정에서 확인</button></div>`;
 const st=document.createElement('style');st.textContent='.rrSection{margin-top:14px;padding:15px 16px;border:1px solid #e0e0da;border-radius:18px;background:#fff}.rrTitle{font-size:11px;font-weight:850;letter-spacing:.1em;color:#777;margin-bottom:8px}.rrSection ul{margin:8px 0 0;padding-left:20px}.rrSection li{margin:8px 0;line-height:1.4}.rrSection li div,.rrSection p{font-size:13px;color:#666;line-height:1.45;margin:3px 0 0}';sheet.appendChild(st);
 document.getElementById('rrDone').onclick=()=>modal.remove();
}
const mo=new MutationObserver(()=>setTimeout(render,20));mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(render,100);
})();

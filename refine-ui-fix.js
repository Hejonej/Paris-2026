(function(){
'use strict';
const CARD='__afieldRefineCardV2';
const STYLE='__afieldRefineUiFix';
function installStyle(){
 if(document.getElementById(STYLE))return;
 const s=document.createElement('style');s.id=STYLE;s.textContent=`
#${CARD}{display:block!important;position:relative!important;overflow:hidden!important;box-sizing:border-box!important;margin:18px 0 22px!important;padding:22px!important;min-height:0!important;height:auto!important}
#${CARD}>.top{position:static!important;top:auto!important;z-index:auto!important;height:auto!important;min-height:0!important;width:100%!important;display:flex!important;grid-template-columns:none!important;align-items:flex-start!important;justify-content:space-between!important;gap:18px!important;padding:0!important;margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important;overflow:visible!important}
#${CARD}>.top>div{min-width:0!important;flex:1 1 auto!important}
#${CARD} h2{font-size:28px!important;line-height:1.05!important;margin:8px 0 10px!important}
#${CARD} p{font-size:14px!important;line-height:1.55!important;margin:0!important;max-width:560px!important}
#${CARD} button{position:static!important;flex:0 0 auto!important;margin:0!important;align-self:flex-start!important;min-height:46px!important;padding:12px 17px!important;white-space:nowrap!important}
@media(max-width:620px){
 #${CARD}{padding:20px!important;margin:16px 0 22px!important;border-radius:24px!important}
 #${CARD}>.top{display:flex!important;flex-direction:column!important;gap:16px!important}
 #${CARD} h2{font-size:27px!important;line-height:1.02!important;margin:8px 0 10px!important}
 #${CARD} p{font-size:14px!important;line-height:1.55!important}
 #${CARD} button{width:100%!important;margin:0!important;align-self:stretch!important;padding:14px 18px!important}
}
.rvProgressHint{margin-top:10px;font-size:12px;line-height:1.45;color:#888}
.rvPulse{display:inline-block;width:7px;height:7px;border-radius:50%;background:#111;margin-right:7px;animation:rvPulse 1.25s ease-in-out infinite}
@keyframes rvPulse{0%,100%{opacity:.25;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
 `;document.head.appendChild(s);
}
function enhanceLoading(){
 const modal=document.getElementById('__afieldRefineModalV2');if(!modal)return;
 const h=[...modal.querySelectorAll('h2')].find(x=>/현재 일정을 읽고 있어요/.test(x.textContent||''));
 if(!h||modal.querySelector('.rvProgressHint'))return;
 const status=modal.querySelector('.rvStatus');
 const hint=document.createElement('div');hint.className='rvProgressHint';hint.innerHTML='<span class="rvPulse"></span><b>Afield가 일정 전체를 비교 중이에요.</b><br>보통 10–30초 정도 걸려요. 장소와 영업시간이 많으면 조금 더 걸릴 수 있어요.';
 (status||h).insertAdjacentElement('afterend',hint);
}
function run(){installStyle();enhanceLoading()}
const mo=new MutationObserver(()=>{clearTimeout(window.__afieldRefineUiFixT);window.__afieldRefineUiFixT=setTimeout(run,30)});mo.observe(document.documentElement,{childList:true,subtree:true});
run();setTimeout(run,300);
})();
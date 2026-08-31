const express=require('express');

if(!express.response.__sv365ComplianceActionIconsPatched){
  express.response.__sv365ComplianceActionIconsPatched=true;
  const originalSend=express.response.send;

  const ui=String.raw`
<script id="sv365ComplianceActionIcons">(()=>{
  if(location.pathname!=='/compliance')return;
  const svg=body=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>';
  const icons={
    register:svg('<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>'),
    resend:svg('<path d="M4 4h16v16H4Z" opacity=".08"/><path d="m4 6 8 6 8-6"/><path d="M19 14v5h-5"/><path d="M19 19a5 5 0 0 0-7-3"/>'),
    complete:svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>')
  };
  function makeIcon(el,kind,label,tone){
    if(!(el instanceof HTMLElement))return;
    el.classList.add('svActionIcon','cmpActionIcon');
    el.classList.toggle('svSuccessIcon',tone==='success');
    el.classList.toggle('svPrimaryIcon',tone!=='success');
    el.setAttribute('title',label);
    el.setAttribute('aria-label',label);
    el.dataset.svActionLabel=label;
    if(el.innerHTML!==icons[kind])el.innerHTML=icons[kind];
  }
  function scan(){
    document.querySelectorAll('[data-register]').forEach(el=>makeIcon(el,'register','View Register'));
    document.querySelectorAll('[data-resend]').forEach(el=>makeIcon(el,'resend','Resend'));
    document.querySelectorAll('[data-complete]').forEach(el=>makeIcon(el,'complete','Mark Complete','success'));
  }
  scan();
  let queued=false;
  new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan()})}).observe(document.documentElement,{childList:true,subtree:true});
})();</script>`;

  express.response.send=function(body){
    const req=this.req;
    if(req&&req.path==='/compliance'&&typeof body==='string'&&body.includes('</body>')&&!body.includes('sv365ComplianceActionIcons'))body=body.replace('</body>',ui+'</body>');
    return originalSend.call(this,body);
  };
}

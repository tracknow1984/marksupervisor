const express=require('express');

if(!express.response.__sv365PrestartRegistrationSafetyPatched){
  express.response.__sv365PrestartRegistrationSafetyPatched=true;
  const originalSend=express.response.send;
  const injection=String.raw`
<style id="svPrestartRegistrationSafetyStyle">
.prestartRegSafety{margin-top:10px;padding:10px 12px;border:1px solid #f0d1d3;background:#fff7f7;border-radius:9px;color:#8d2f35;font-size:11px;line-height:1.45}.prestartRegSafety b{color:#a2262e}.prestartRegSafety.ok{border-color:#dce5ed;background:#f8fafc;color:#697789}.bigSelect option:disabled{color:#a8383f;background:#fff4f4}
</style>
<script id="svPrestartRegistrationSafetyV1">
(()=>{
  const primary=document.getElementById('primary'),secondary=document.getElementById('secondary'),begin=document.getElementById('beginBtn');
  if(!primary||primary.dataset.regSafetyReady==='1')return;
  primary.dataset.regSafetyReady='1';
  let blocked=new Map();
  const brisbaneDate=()=>{const parts=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day};
  const validIso=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
  const expired=a=>validIso(a&&a.registrationExpiry)&&String(a.registrationExpiry)<brisbaneDate();
  const dateAU=v=>{if(!validIso(v))return String(v||'');const x=String(v).split('-');return x[2]+'/'+x[1]+'/'+x[0]};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const card=primary.closest('.stepCard');
  const note=document.createElement('div');note.className='prestartRegSafety ok';note.id='prestartRegSafety';note.innerHTML='<b>Registration safety check:</b> Supervisor365 verifies registration before a pre-start can begin.';
  if(card){const preview=document.getElementById('primaryPreview');if(preview)preview.insertAdjacentElement('afterend',note);else primary.insertAdjacentElement('afterend',note)}

  function decorateSelect(select){
    if(!select)return;
    [...select.options].forEach(opt=>{
      if(!opt.value)return;
      const a=blocked.get(String(opt.value));
      if(a){
        opt.disabled=true;opt.dataset.regExpired='1';
        const base=opt.dataset.baseText||opt.textContent.replace(/\s+—\s+REGISTRATION EXPIRED.*$/,'');opt.dataset.baseText=base;
        opt.textContent=base+' — REGISTRATION EXPIRED '+dateAU(a.registrationExpiry);
      }else if(opt.dataset.regExpired==='1'){
        opt.disabled=false;opt.textContent=opt.dataset.baseText||opt.textContent;delete opt.dataset.regExpired;
      }
    });
  }
  function updateNote(){
    const n=blocked.size;
    note.classList.toggle('ok',n===0);
    note.innerHTML=n?'<b>Safety lock active:</b> '+n+' asset'+(n===1?' is':'s are')+' unavailable because registration has expired. Renew the registration and update the asset record before completing a pre-start.':'<b>Registration safety check:</b> No expired registrations are currently blocking asset selection.';
  }
  function clearBlockedSelection(select){
    if(!select||!blocked.has(String(select.value)))return false;
    const a=blocked.get(String(select.value));
    select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));
    alert('Pre-start blocked: '+(a.rego||a.name||a.id)+' registration expired on '+dateAU(a.registrationExpiry)+'.');
    return true;
  }
  function apply(){decorateSelect(primary);decorateSelect(secondary);updateNote();if(blocked.has(String(primary.value)))clearBlockedSelection(primary);if(secondary&&blocked.has(String(secondary.value)))secondary.value=''}
  async function load(){
    try{
      const r=await fetch('/api/assets',{cache:'no-store'}),assets=await r.json();
      if(!r.ok||!Array.isArray(assets))return;
      blocked=new Map(assets.filter(expired).map(a=>[String(a.id),a]));apply();
    }catch(e){console.warn('Pre-start registration safety check failed',e)}
  }
  primary.addEventListener('change',()=>clearBlockedSelection(primary),true);
  if(secondary)secondary.addEventListener('change',()=>clearBlockedSelection(secondary),true);
  if(begin)begin.addEventListener('click',e=>{if(clearBlockedSelection(primary)){e.preventDefault();e.stopImmediatePropagation()}},true);
  if(secondary)new MutationObserver(()=>decorateSelect(secondary)).observe(secondary,{childList:true});
  new MutationObserver(()=>decorateSelect(primary)).observe(primary,{childList:true});
  load();setTimeout(apply,250);setTimeout(apply,1000);setInterval(load,60000);
})();
</script>`;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('id="primary"')&&body.includes('id="beginBtn"')&&!body.includes('svPrestartRegistrationSafetyV1')){
      if(body.includes('</body>'))body=body.replace('</body>',injection+'</body>');
    }
    return originalSend.call(this,body);
  };
}

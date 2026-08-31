const express=require('express');

if(!express.response.__sv365PrestartFitnessDutyUi){
  express.response.__sv365PrestartFitnessDutyUi=true;
  const originalSend=express.response.send;
  const ui=String.raw`
<style id="sv365FitnessDutyStyle">
.fitnessDuty{margin:14px 16px 0;padding:15px 16px;border:1px solid #cfe0ef;background:linear-gradient(135deg,#f7fbff,#fff);border-radius:12px;color:#344054}.fitnessDuty h3{margin:0 0 7px;font-size:15px;color:#172433}.fitnessDutyLead{font-size:12px;font-weight:800;margin:0 0 10px}.fitnessDuty ul{margin:0 0 13px;padding-left:19px;display:grid;gap:8px}.fitnessDuty li{font-size:11px;line-height:1.5;color:#4c5c6e}.fitnessDutyConfirm{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid #b9d7ef;background:#f0f8ff;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer}.fitnessDutyConfirm input{width:21px;height:21px;flex:0 0 21px;margin-top:1px;accent-color:#2577e3}.fitnessDutyState{font-size:10px;color:#8a5d12;margin-top:8px;font-weight:750}.fitnessDuty.ready{border-color:#b9dfc8;background:linear-gradient(135deg,#f5fcf8,#fff)}.fitnessDuty.ready .fitnessDutyConfirm{border-color:#b9dfc8;background:#eef9f2}.fitnessDuty.ready .fitnessDutyState{color:#17884c}.sigbox.fitnessLocked{opacity:.72}.sigbox.fitnessLocked canvas{cursor:not-allowed!important}.sigbox:not(.fitnessLocked) canvas{cursor:crosshair}
</style>
<script id="sv365FitnessDutyScript">(()=>{
  if(window.__sv365FitnessDuty)return;window.__sv365FitnessDuty=true;
  const VERSION='2026-08-31';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function inject(card){
    const sigbox=card.querySelector('.sigbox'),canvas=sigbox?.querySelector('canvas.signature');
    if(!sigbox||!canvas||card.querySelector('.fitnessDuty'))return;
    const assetId=String(canvas.id||'').replace(/^sig_/,''),box=document.createElement('section');
    box.className='fitnessDuty';
    box.innerHTML='<h3>Fitness for Duty Declaration</h3><p class="fitnessDutyLead">I hereby declare and confirm the following before commencing my shift:</p><ul><li><b>Fatigue Management:</b> I have had the required restorative rest break, feel adequately slept, and am not impaired by fatigue.</li><li><b>Alcohol and Other Drugs:</b> I am completely free from the influence of alcohol, illicit drugs, or any prescription/over-the-counter medications that may impair my driving ability or cognitive judgment.</li><li><b>Physical &amp; Mental Health:</b> I am not suffering from any temporary illness, injury, medical episode, or extreme psychological/emotional distress that makes me unfit to operate a heavy vehicle safely.</li><li><b>Compliance &amp; Obligations:</b> I understand my primary duty under the Heavy Vehicle National Law (HVNL) to stop driving or step away immediately if my fitness for duty changes during my shift.</li></ul><label class="fitnessDutyConfirm"><input type="checkbox" id="fitnessDuty_'+esc(assetId)+'" data-fitness-asset="'+esc(assetId)+'"><span>I have read, understood and confirm this Fitness for Duty declaration before signing this pre-start.</span></label><div class="fitnessDutyState">Confirm the declaration to enable the signature pad.</div>';
    sigbox.insertAdjacentElement('beforebegin',box);
    const cb=box.querySelector('[data-fitness-asset]'),state=box.querySelector('.fitnessDutyState');
    const sync=()=>{
      const ready=!!cb.checked;box.classList.toggle('ready',ready);sigbox.classList.toggle('fitnessLocked',!ready);canvas.style.pointerEvents=ready?'auto':'none';canvas.style.opacity=ready?'1':'.55';state.textContent=ready?'Declaration confirmed — signature pad enabled.':'Confirm the declaration to enable the signature pad.';
      if(!ready&&canvas.dataset.signed==='1'){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);canvas.dataset.signed='0'}
    };
    cb.addEventListener('change',sync);sync();
  }
  function scan(){document.querySelectorAll('#forms .inspectionCard').forEach(inject)}
  scan();new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  const submit=document.getElementById('submitBtn');
  if(submit)submit.addEventListener('click',e=>{scan();for(const card of document.querySelectorAll('#forms .inspectionCard')){const cb=card.querySelector('[data-fitness-asset]');if(cb&&!cb.checked){e.preventDefault();e.stopImmediatePropagation();cb.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>cb.focus(),250);alert('Confirm the Fitness for Duty declaration before signing and submitting this pre-start.');return}},true);
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    const url=typeof input==='string'?input:(input&&input.url)||'',method=String(init?.method||'GET').toUpperCase();
    if((url==='/api/prestarts'||url.endsWith('/api/prestarts'))&&method==='POST'&&init?.body){
      try{const payload=JSON.parse(init.body);if(Array.isArray(payload.records)){const acceptedAt=new Date().toISOString();payload.records=payload.records.map(r=>{const cb=document.querySelector('[data-fitness-asset="'+CSS.escape(String(r.assetId))+'"]');return {...r,fitnessForDutyAccepted:!!cb?.checked,fitnessForDutyAcceptedAt:cb?.checked?acceptedAt:null,fitnessForDutyVersion:VERSION}});init={...init,body:JSON.stringify(payload)}}}catch{}
    }
    return nativeFetch(input,init);
  };
})();</script>`;
  express.response.send=function(body){
    if(this.req?.path==='/prestarts'&&typeof body==='string'&&body.includes('</body>')&&!body.includes('sv365FitnessDutyScript'))body=body.replace('</body>',ui+'</body>');
    return originalSend.call(this,body);
  };
}

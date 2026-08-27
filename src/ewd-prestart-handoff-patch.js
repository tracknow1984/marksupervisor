const express=require('express');

if(!express.response.__sv365EwdPrestartHandoff){
  express.response.__sv365EwdPrestartHandoff=true;
  const originalSend=express.response.send;
  const script=String.raw`<script id="svEwdPrestartHandoff">(()=>{
    if(location.pathname!=='/prestarts')return;
    const $=id=>document.getElementById(id);
    const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    let employeeList=[];
    function ensureDriverPanel(){
      const primary=$('primary'),card=primary?.closest('.stepCard');if(!primary||!card)return false;
      let select=$('prestartEmployee');
      if(!select){
        const wrap=document.createElement('div');wrap.id='ewdDriverPanel';wrap.style.cssText='margin-bottom:16px;padding:14px;border:1px solid #a9dff0;background:linear-gradient(135deg,#f3fbff,#eef8fc);border-radius:12px;box-shadow:0 6px 18px rgba(28,116,160,.08)';
        wrap.innerHTML='<div style="font-size:10px;font-weight:900;color:#1681b4;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px">EWD Driver Required</div><div class="field"><label>Driver / Employee <span class="req">*</span></label><select id="prestartEmployee" class="bigSelect"><option value="">Loading employees...</option></select><div class="sub" style="margin-top:6px">This driver will be linked to the vehicle and the Electronic Work Diary after a Passed pre-start.</div></div>';
        card.insertBefore(wrap,card.firstChild);select=$('prestartEmployee');
      }else{
        const host=select.closest('.field')?.parentElement||select.closest('.field');if(host){host.style.border='1px solid #a9dff0';host.style.background='linear-gradient(135deg,#f3fbff,#eef8fc)';host.style.borderRadius='12px'}
      }
      return true;
    }
    async function loadEmployees(){
      if(!ensureDriverPanel())return;
      const select=$('prestartEmployee');
      try{const r=await fetch('/api/employees',{cache:'no-store'}),d=await r.json();employeeList=Array.isArray(d)?d:[];if(!employeeList.length){select.innerHTML='<option value="">No employees available</option>';select.disabled=true;return}const existing=select.value;select.innerHTML='<option value="">Select driver / employee...</option>'+employeeList.map(e=>'<option value="'+esc(e.id)+'">'+esc([e.firstName,e.lastName].filter(Boolean).join(' '))+'</option>').join('');if(existing)select.value=existing}catch{select.innerHTML='<option value="">Unable to load employees</option>'}
    }
    function showReady(x){
      if(!x?.employeeId)return;
      const old=$('ewdReadyCard');if(old)old.remove();
      const card=document.createElement('section');card.id='ewdReadyCard';card.style.cssText='margin:0 auto 16px;max-width:760px;padding:20px;border-radius:16px;background:linear-gradient(135deg,#071522,#0c3548);color:white;box-shadow:0 18px 45px rgba(5,28,42,.2);border:1px solid rgba(67,208,245,.28)';
      card.innerHTML='<div style="font-size:10px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#55d9f7">Pre-Start Passed · EWD Ready</div><div style="font-size:22px;font-weight:950;margin:5px 0">'+esc(x.rego||x.assetName||'Vehicle')+'</div><div style="font-size:11px;color:#a9c0cf;margin-bottom:14px">The driver has been linked and can now begin the Electronic Work Diary.</div><a href="'+esc(x.ewdUrl||('/ewd?employee='+encodeURIComponent(x.employeeId)))+'" style="display:block;text-align:center;text-decoration:none;background:linear-gradient(135deg,#3bd6f5,#2194cf);color:#fff;border-radius:12px;padding:15px;font-size:15px;font-weight:950">START ELECTRONIC WORK DIARY →</a>';
      const main=document.querySelector('.preMobile')||document.querySelector('.content');main?.prepend(card);card.scrollIntoView({behavior:'smooth',block:'start'});
    }
    try{const ready=JSON.parse(sessionStorage.getItem('sv365.ewdReady')||'null');if(ready){sessionStorage.removeItem('sv365.ewdReady');setTimeout(()=>showReady(ready),100)}}catch{}
    const prevFetch=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(url.includes('/api/prestarts')&&init&&String(init.method||'').toUpperCase()==='POST'&&init.body){
        const select=$('prestartEmployee');const employeeId=select?.value||'';
        if(!employeeId)throw new Error('Select the driver / employee before submitting the pre-start.');
        try{const payload=JSON.parse(init.body);payload.employeeId=employeeId;const emp=employeeList.find(e=>String(e.id)===String(employeeId));if(emp)payload.inspector=[emp.firstName,emp.lastName].filter(Boolean).join(' ');if(Array.isArray(payload.records))payload.records=payload.records.map((r,i)=>({...r,isPrimary:i===0}));init={...init,body:JSON.stringify(payload)}}catch(e){if(e.message?.includes('Select the driver'))throw e}
      }
      const response=await prevFetch(input,init);
      if(url.includes('/api/prestarts')&&init&&String(init.method||'').toUpperCase()==='POST'&&response.ok){
        try{const saved=await response.clone().json(),primary=Array.isArray(saved)?saved.find(x=>x.isPrimary):null;if(primary?.ewdEligible){sessionStorage.setItem('sv365.ewdReady',JSON.stringify({employeeId:primary.employeeId,prestartId:primary.id,rego:primary.rego,assetName:primary.assetName,ewdUrl:primary.ewdUrl}))}}catch{}
      }
      return response;
    };
    const begin=$('beginBtn');if(begin)begin.addEventListener('click',e=>{const select=$('prestartEmployee');if(select&&!select.value){e.preventDefault();e.stopImmediatePropagation();select.focus();alert('Select the driver / employee before starting the inspection.')}},true);
    if(!ensureDriverPanel()){let tries=0;const t=setInterval(()=>{tries++;if(ensureDriverPanel()||tries>30){clearInterval(t);if(tries<=30)loadEmployees()}},100)}else loadEmployees();
  })();</script>`;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('</body>')&&body.includes('id="submitBtn"')&&body.includes('/api/prestarts')&&!body.includes('svEwdPrestartHandoff'))body=body.replace('</body>',script+'</body>');
    return originalSend.call(this,body);
  };
}

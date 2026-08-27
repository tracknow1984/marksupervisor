const express=require('express');
const {employees}=require('./store');
const ewd=require('./ewd-store');

const pinAdminRouter=express.Router();
const clean=v=>String(v??'').trim();
const validPin=v=>/^\d{4,8}$/.test(clean(v));

pinAdminRouter.get('/api/ewd/employee-pin-status',(req,res)=>{
  res.set('Cache-Control','no-store');
  res.json(employees.map(e=>({
    employeeId:e.id,
    employeeAccess:e.employeeAccess||'',
    driverName:[e.firstName,e.lastName].filter(Boolean).join(' ').trim()||e.email||e.id,
    hasPin:ewd.hasPin(e.id)
  })));
});

pinAdminRouter.patch('/api/employees/:id/ewd-pin',(req,res)=>{
  try{
    const employee=employees.find(e=>String(e.id)===String(req.params.id));
    if(!employee)return res.status(404).json({error:'Employee not found'});
    const pin=clean(req.body?.pin);
    if(!validPin(pin))return res.status(400).json({error:'EWD PIN must be 4 to 8 digits'});
    ewd.setPin(employee.id,pin);
    res.set('Cache-Control','no-store');
    res.json({ok:true,employeeId:employee.id,hasPin:true,updatedAt:new Date().toISOString()});
  }catch(e){
    res.status(500).json({error:e.message||'Unable to save EWD PIN'});
  }
});

if(!express.__sv365EmployeeEwdPinApi){
  express.__sv365EmployeeEwdPinApi=true;
  const previousJson=express.json;
  express.json=function(...args){
    const parser=previousJson(...args);
    return function sv365JsonWithEmployeeEwdPin(req,res,next){
      parser(req,res,err=>err?next(err):pinAdminRouter(req,res,next));
    };
  };
}

if(!express.response.__sv365EmployeeEwdPinUi){
  express.response.__sv365EmployeeEwdPinUi=true;
  const originalSend=express.response.send;
  const ui=String.raw`
<style id="svEmployeeEwdPinStyle">
.ewdPinStatus{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:900;white-space:nowrap}.ewdPinStatus i{width:7px;height:7px;border-radius:50%}.ewdPinStatus.set{background:#eaf8f0;color:#17884c}.ewdPinStatus.set i{background:#22a06b}.ewdPinStatus.missing{background:#fff3e7;color:#a7640d}.ewdPinStatus.missing i{background:#e5a32f}.ewdPinStatus.na{background:#f2f4f7;color:#7a8797}.ewdPinStatus.na i{background:#a7b0bb}.ewdPinBtn{margin-top:6px;border:1px solid #d8e0e9;background:#fff;color:#344054;border-radius:8px;padding:6px 8px;font-size:9px;font-weight:850;cursor:pointer}.ewdPinBtn:hover{background:#eef8fd;border-color:#9fd7e9}.ewdPinCreate{border:1px solid #a9dff0;background:linear-gradient(135deg,#f3fbff,#eef8fc);border-radius:10px;padding:11px}.ewdPinCreate .sub{margin-top:5px}.ewdPinModal{display:none;position:fixed;inset:0;background:#0f172a99;z-index:1200;align-items:center;justify-content:center;padding:20px}.ewdPinModal.open{display:flex}.ewdPinBox{width:min(480px,96vw);background:#fff;border-radius:16px;box-shadow:0 28px 80px #0005;overflow:hidden}.ewdPinHead{padding:18px 20px;border-bottom:1px solid #e6ebf1;display:flex;justify-content:space-between;gap:12px}.ewdPinHead h2{margin:0 0 4px}.ewdPinBody{padding:20px}.ewdPinSecurity{margin-top:12px;padding:10px 11px;border:1px solid #dce8ef;background:#f6fbfe;border-radius:9px;font-size:10px;color:#586b7c;line-height:1.45}.ewdPinActions{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid #e7ebf0;background:#fafbfc}.ewdPinClose{border:0;background:none;font-size:25px;cursor:pointer}
</style>
<script id="svEmployeeEwdPinScript">(()=>{
  if(location.pathname!=='/employees')return;
  const $=id=>document.getElementById(id);
  let pinStatus=new Map(),currentEmployeeId='',refreshTimer=0,busy=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function ensureCreateField(){
    const access=$('eAccess');if(!access)return false;
    if(!$('eEwdPin')){
      const field=document.createElement('div');field.id='ewdPinCreateField';field.className='field ewdPinCreate';
      field.innerHTML='<label>EWD PIN <span class="req">*</span></label><input id="eEwdPin" inputmode="numeric" type="password" maxlength="8" autocomplete="new-password" placeholder="4-8 digits"><div class="sub">Set once for Driver access. The driver will use this PIN for all future EWD authentication and daily confirmation.</div>';
      access.closest('.field')?.insertAdjacentElement('afterend',field);
    }
    const sync=()=>{const field=$('ewdPinCreateField'),driver=access.value==='Driver';if(field)field.style.display=driver?'block':'none';if(!driver&&$('eEwdPin'))$('eEwdPin').value=''};
    if(access.dataset.ewdPinBound!=='1'){access.dataset.ewdPinBound='1';access.addEventListener('change',sync)}sync();
    return true;
  }

  function ensureModal(){
    if($('ewdPinModal'))return;
    document.body.insertAdjacentHTML('beforeend','<div id="ewdPinModal" class="ewdPinModal"><div class="ewdPinBox"><div class="ewdPinHead"><div><h2>Set EWD PIN</h2><div class="sub" id="ewdPinEmployee"></div></div><button type="button" class="ewdPinClose" id="closeEwdPin">×</button></div><div class="ewdPinBody"><div class="field"><label>New EWD PIN *</label><input id="ewdPinValue" inputmode="numeric" type="password" maxlength="8" autocomplete="new-password" placeholder="4-8 digits"></div><div class="field" style="margin-top:11px"><label>Confirm EWD PIN *</label><input id="ewdPinConfirm" inputmode="numeric" type="password" maxlength="8" autocomplete="new-password" placeholder="Repeat PIN"></div><div class="ewdPinSecurity">The PIN is stored as a salted cryptographic hash in the EWD security store. Supervisor365 does not return or display the saved PIN. Resetting it replaces the old credential.</div></div><div class="ewdPinActions"><button type="button" class="secondary" id="cancelEwdPin">Cancel</button><button type="button" class="primary" id="saveEwdPin">Save EWD PIN</button></div></div></div>');
    const close=()=>{$('ewdPinModal').classList.remove('open');currentEmployeeId='';$('ewdPinValue').value='';$('ewdPinConfirm').value=''};
    $('closeEwdPin').onclick=close;$('cancelEwdPin').onclick=close;$('ewdPinModal').onclick=e=>{if(e.target===$('ewdPinModal'))close()};
    $('saveEwdPin').onclick=async()=>{
      const pin=$('ewdPinValue').value.trim(),confirm=$('ewdPinConfirm').value.trim();
      if(!/^\d{4,8}$/.test(pin))return alert('EWD PIN must be 4 to 8 digits.');
      if(pin!==confirm)return alert('The EWD PIN confirmation does not match.');
      if(!currentEmployeeId)return;
      const btn=$('saveEwdPin');btn.disabled=true;btn.textContent='Saving…';
      try{const r=await fetch('/api/employees/'+encodeURIComponent(currentEmployeeId)+'/ewd-pin',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})}),j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to save EWD PIN');close();await loadStatus();enhanceRows()}catch(e){alert(e.message)}finally{btn.disabled=false;btn.textContent='Save EWD PIN'}
    };
  }

  async function loadStatus(){
    try{const r=await fetch('/api/ewd/employee-pin-status',{cache:'no-store'}),d=await r.json();if(!r.ok||!Array.isArray(d))return;pinStatus=new Map(d.map(x=>[String(x.employeeId),x]))}catch{}
  }
  function openPin(id){ensureModal();const row=pinStatus.get(String(id)),existing=!!row?.hasPin;currentEmployeeId=String(id);$('ewdPinEmployee').textContent=(row?.driverName||'Employee')+' · '+(existing?'Reset existing PIN':'Create PIN');$('ewdPinValue').value='';$('ewdPinConfirm').value='';$('ewdPinModal').classList.add('open');setTimeout(()=>$('ewdPinValue').focus(),40)}
  function enhanceRows(){
    const table=$('employeeRows')?.closest('table');if(!table)return;
    const head=table.querySelector('thead tr');if(head&&!head.querySelector('[data-ewd-pin-head]')){const th=document.createElement('th');th.dataset.ewdPinHead='1';th.textContent='EWD PIN';head.insertBefore(th,head.lastElementChild)}
    const empty=$('employeeRows')?.querySelector('.empty')?.closest('td');if(empty)empty.colSpan=7;
    $('employeeRows')?.querySelectorAll('tr').forEach(tr=>{
      const health=tr.querySelector('[data-health]');if(!health)return;const id=String(health.dataset.health),status=pinStatus.get(id);let td=tr.querySelector('[data-ewd-pin-cell]');if(!td){td=document.createElement('td');td.dataset.ewdPinCell='1';health.closest('td').insertAdjacentElement('beforebegin',td)}
      const driver=String(status?.employeeAccess||'')==='Driver';
      if(!driver){td.innerHTML='<span class="ewdPinStatus na"><i></i>Not required</span>';return}
      const set=!!status?.hasPin;td.innerHTML='<span class="ewdPinStatus '+(set?'set':'missing')+'"><i></i>'+(set?'Configured':'Not Set')+'</span><br><button type="button" class="ewdPinBtn" data-ewd-pin="'+esc(id)+'">'+(set?'Reset PIN':'Set PIN')+'</button>';
    });
    $('employeeRows')?.querySelectorAll('[data-ewd-pin]').forEach(b=>b.onclick=()=>openPin(b.dataset.ewdPin));
  }
  async function refresh(){if(busy)return;busy=true;try{ensureCreateField();ensureModal();await loadStatus();enhanceRows()}finally{busy=false}}
  function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,100)}

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    const url=typeof input==='string'?input:(input&&input.url)||'',method=String(init?.method||'GET').toUpperCase();
    if(url==='/api/employees'&&method==='POST'){
      const access=$('eAccess')?.value||'',pin=$('eEwdPin')?.value.trim()||'';
      if(access==='Driver'&&!/^\d{4,8}$/.test(pin))throw new Error('Set a 4-8 digit EWD PIN for this Driver before saving the employee.');
      const response=await nativeFetch(input,init);
      if(response.ok&&access==='Driver'&&pin){try{const employee=await response.clone().json();const pr=await nativeFetch('/api/employees/'+encodeURIComponent(employee.id)+'/ewd-pin',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});if(!pr.ok){const pj=await pr.json().catch(()=>({}));throw new Error(pj.error||'Employee saved but EWD PIN could not be configured')}}catch(e){alert(e.message)}}
      schedule();return response;
    }
    return nativeFetch(input,init);
  };

  const saveEmployee=$('saveEmployee');if(saveEmployee)saveEmployee.addEventListener('click',e=>{if($('eAccess')?.value==='Driver'&&!/^\d{4,8}$/.test($('eEwdPin')?.value.trim()||'')){e.preventDefault();e.stopImmediatePropagation();$('eEwdPin')?.focus();alert('Set a 4-8 digit EWD PIN for this Driver before saving the employee.')}},true);
  const rows=$('employeeRows');if(rows)new MutationObserver(schedule).observe(rows,{childList:true});
  if(!ensureCreateField()){let tries=0;const t=setInterval(()=>{tries++;if(ensureCreateField()||tries>30)clearInterval(t)},100)}
  ensureModal();refresh();
})();</script>`;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('</body>')&&reqPath(this)==='/employees'&&!body.includes('svEmployeeEwdPinScript'))body=body.replace('</body>',ui+'</body>');
    return originalSend.call(this,body);
  };
  function reqPath(res){return res?.req?.path||''}
}

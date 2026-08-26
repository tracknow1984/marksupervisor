const express=require('express');
const {assets,employees}=require('./store');
const operations=require('./persistent-store');
const services=require('./service-store');
const incidents=require('./incident-store');
const compliance=require('./compliance-store');

const DAY=86400000;
const startToday=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const parseDate=v=>{if(!v)return null;const d=new Date(String(v).slice(0,10)+'T23:59:59');return Number.isFinite(d.getTime())?d:null};
const daysUntil=v=>{const d=parseDate(v);return d?Math.ceil((d.getTime()-startToday().getTime())/DAY):null};
const activeDefect=d=>!['RESOLVED','CLOSED'].includes(String(d.status||'').toUpperCase());
const activeIncident=i=>String(i.status||'OPEN').toUpperCase()!=='CLOSED';
const activeService=s=>String(s.status||'').toUpperCase()==='SCHEDULED';
const enc=v=>encodeURIComponent(String(v??''));

function expiryProblem(asset){
  const checks=[
    {key:'registrationExpiry',label:'Registration',date:asset.registrationExpiry},
    {key:'insuranceExpiry',label:'Insurance',date:asset.insuranceExpiry},
    {key:'coiDueDate',label:'Certificate of Inspection',date:asset.coiDueDate}
  ].map(x=>({...x,days:daysUntil(x.date)}));
  return checks.find(x=>x.days===null||x.days<0)||null;
}
function employeeHealth(e){
  const c=e.compliance||{};
  const valid=v=>{const d=parseDate(v);return !!d&&d.getTime()>=Date.now()};
  const induction=!!c.induction?.complete&&!!c.induction?.signedOffDate;
  const licence=!!c.licence?.checked&&!!String(e.licenceNo||'').trim()&&valid(e.licenceExpiry);
  const medical=!!c.medical?.current&&!!c.medical?.reviewedDate&&(!c.medical?.expiryDate||valid(c.medical.expiryDate));
  const n=[induction,licence,medical].filter(Boolean).length;
  return n===3?100:n===2?67:n===1?33:0;
}
function serviceOverdue(s){const d=daysUntil(s.requestedDate);return activeService(s)&&d!==null&&d<0}

function exactAttention(){
  const attention=[];
  assets.filter(a=>!['Retired','Sold','Decommissioned'].includes(String(a.status||''))).forEach(a=>{
    const issue=expiryProblem(a);if(!issue)return;
    attention.push({tone:'red',icon:'expiry',title:`${a.rego||a.id} expiry action`,detail:issue.days===null?`${issue.label}: no date recorded`:`${issue.label}: ${Math.abs(issue.days)} day${Math.abs(issue.days)===1?'':'s'} overdue`,href:`/assets?resolve=expiry&asset=${enc(a.id)}&field=${enc(issue.key)}`});
  });
  services.list().filter(serviceOverdue).forEach(s=>attention.push({tone:'red',icon:'service',title:`${s.rego||s.assetId} service overdue`,detail:`${s.serviceType||'Service'} · ${Math.abs(daysUntil(s.requestedDate)||0)} day(s) overdue`,href:`/service?resolve=service&service=${enc(s.id)}`}));
  operations.listDefects().filter(d=>activeDefect(d)&&String(d.priority||'').toUpperCase()==='HIGH').forEach(d=>attention.push({tone:'red',icon:'defect',title:`High priority defect · ${d.rego||d.assetId}`,detail:d.defect||'Vehicle defect',href:`/vehicle-defects?resolve=defect&defect=${enc(d.id)}`}));
  incidents.list().filter(activeIncident).forEach(i=>attention.push({tone:'amber',icon:'incident',title:`Incident ${i.status||'OPEN'} · ${i.vehicleRego||i.vehicleId||''}`,detail:`${i.employeeName||'Employee'} · ${i.incidentDate||''}`,href:`/incident-register/${enc(i.id)}?from=dashboard`}));
  for(const doc of compliance.list()){
    if(!doc.dueDate||new Date(doc.dueDate+'T23:59:59').getTime()>=Date.now())continue;
    for(const r of (doc.recipients||[])){
      if(r.completedAt)continue;
      attention.push({tone:'red',icon:'compliance',title:`Compliance overdue · ${r.employeeName||r.employeeId}`,detail:`${doc.subject||doc.category||'Compliance'} · due ${doc.dueDate}`,href:`/compliance?resolve=compliance&document=${enc(doc.id)}&employee=${enc(r.employeeId)}`});
    }
  }
  employees.forEach(e=>{const pct=employeeHealth(e);if(pct>=100)return;const name=[e.firstName,e.lastName].filter(Boolean).join(' ')||e.id;attention.push({tone:'amber',icon:'people',title:`${name} compliance ${pct}%`,detail:'Staff compliance health check requires attention',href:`/employees?resolve=employee&employee=${enc(e.id)}`})});
  return attention.slice(0,14);
}

if(!express.response.__sv365DashboardAttentionJsonPatched){
  express.response.__sv365DashboardAttentionJsonPatched=true;
  const originalJson=express.response.json;
  express.response.json=function(body){
    const req=this.req;
    if(req&&req.path==='/api/dashboard/overview'&&body&&typeof body==='object'&&!Array.isArray(body))body={...body,attention:exactAttention()};
    return originalJson.call(this,body);
  };
}

if(!express.response.__sv365DashboardDeepLinksPatched){
  express.response.__sv365DashboardDeepLinksPatched=true;
  const originalSend=express.response.send;
  const style=String.raw`<style id="svDashboardDeepLinkStyle">.svActionFocus{position:relative;outline:3px solid rgba(37,119,227,.32)!important;box-shadow:0 0 0 7px rgba(37,119,227,.09)!important;border-radius:8px;animation:svActionPulse 1.15s ease-in-out 3}.svDeepField{border-color:#2577e3!important;box-shadow:0 0 0 4px rgba(37,119,227,.13)!important;background:#f7fbff!important}.svActionBanner{margin:0 0 14px;padding:11px 13px;border:1px solid #b8d8fa;background:#f1f7ff;border-radius:10px;color:#245f9d;font-size:11px;font-weight:800}@keyframes svActionPulse{0%,100%{box-shadow:0 0 0 3px rgba(37,119,227,.08)}50%{box-shadow:0 0 0 9px rgba(37,119,227,.16)}}@media(prefers-reduced-motion:reduce){.svActionFocus{animation:none}}</style>`;
  const script=String.raw`<script id="svDashboardDeepLinks">(()=>{const p=new URLSearchParams(location.search),mode=p.get('resolve');if(!mode)return;const path=location.pathname;const attr=s=>String(s||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"');const wait=(find,done,tries=0)=>{const x=find();if(x)return done(x);if(tries>60)return;setTimeout(()=>wait(find,done,tries+1),100)};const mark=el=>{if(!el)return;el.classList.add('svActionFocus');el.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>el.classList.remove('svActionFocus'),7000)};const clean=()=>{const q=new URLSearchParams(location.search);['resolve','asset','field','service','defect','document','employee'].forEach(k=>q.delete(k));history.replaceState({},'',location.pathname+(q.toString()?'?'+q.toString():'')+location.hash)};const banner=(host,text)=>{if(!host||host.querySelector('.svActionBanner'))return;const b=document.createElement('div');b.className='svActionBanner';b.textContent=text;host.prepend(b)};
if(path==='/assets'&&mode==='expiry'){const id=p.get('asset'),field=p.get('field'),fieldMap={registrationExpiry:'fRegistrationExpiry',insuranceExpiry:'fInsuranceExpiry',coiDueDate:'fCoiDueDate'},labelMap={registrationExpiry:'Registration Expiry',insuranceExpiry:'Insurance Expiry',coiDueDate:'Certificate of Inspection Due Date'};wait(()=>document.querySelector('[data-edit="'+attr(id)+'"]'),btn=>{btn.click();wait(()=>document.getElementById(fieldMap[field]||''),input=>{input.classList.add('svDeepField');input.focus();input.scrollIntoView({behavior:'smooth',block:'center'});const modal=document.getElementById('assetModal'),host=modal&&modal.querySelector('.viewerbody');banner(host,'Dashboard action: update '+(labelMap[field]||'the expired compliance date')+' for this asset.');clean()})})}
else if(path==='/service'&&mode==='service'){const id=p.get('service'),target='/service/'+encodeURIComponent(id)+'/complete';wait(()=>[...document.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')===target),a=>{const row=a.closest('tr');mark(row);a.focus();banner(row&&row.closest('.panel'),'Dashboard action: this overdue service needs to be completed, rescheduled or cancelled.');clean()})}
else if(path==='/vehicle-defects'&&mode==='defect'){const id=p.get('defect');wait(()=>document.querySelector('[data-row="'+attr(id)+'"]'),row=>{mark(row);const status=document.querySelector('[data-status="'+attr(id)+'"]');if(status)status.focus();banner(row.closest('.panel'),'Dashboard action: review and resolve this high-priority defect.');clean()})}
else if(path==='/employees'&&mode==='employee'){const id=p.get('employee');wait(()=>document.querySelector('[data-health="'+attr(id)+'"]'),btn=>{btn.click();wait(()=>document.getElementById('healthModal')?.classList.contains('open')?document.getElementById('healthModal'):null,modal=>{const host=modal.querySelector('.healthBody');banner(host,'Dashboard action: complete the outstanding staff compliance health checks below.');clean()})})}
else if(path==='/compliance'&&mode==='compliance'){const doc=p.get('document'),emp=p.get('employee');wait(()=>document.querySelector('[data-register="'+attr(doc)+'"]'),btn=>{btn.click();const key=doc+'|'+emp;wait(()=>[...document.querySelectorAll('[data-resend],[data-complete]')].find(b=>b.dataset.resend===key||b.dataset.complete===key),action=>{const row=action.closest('tr');mark(row);action.focus();const host=document.getElementById('regBody');banner(host,'Dashboard action: this employee has an overdue compliance acknowledgement. Resend the request or mark it complete once verified.');clean()})})}
})();</script>`;
  express.response.send=function(body){
    const req=this.req;
    if(req&&typeof body==='string'&&body.includes('</head>')&&!body.includes('svDashboardDeepLinkStyle'))body=body.replace('</head>',style+'</head>');
    if(req&&typeof body==='string'&&body.includes('</body>')&&!body.includes('svDashboardDeepLinks')&&['/assets','/service','/vehicle-defects','/employees','/compliance'].includes(req.path))body=body.replace('</body>',script+'</body>');
    return originalSend.call(this,body);
  };
}

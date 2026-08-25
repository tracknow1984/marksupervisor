const express=require('express');
const router=express.Router();
const {page}=require('../layout');
const {assets,employees}=require('../store');
const operations=require('../persistent-store');
const services=require('../service-store');
const incidents=require('../incident-store');
const compliance=require('../compliance-store');

const DAY=86400000;
const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const startToday=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const parseDate=v=>{if(!v)return null;const d=new Date(String(v).slice(0,10)+'T23:59:59');return Number.isFinite(d.getTime())?d:null};
const daysUntil=v=>{const d=parseDate(v);if(!d)return null;return Math.ceil((d.getTime()-startToday().getTime())/DAY)};
const activeDefect=d=>!['RESOLVED','CLOSED'].includes(String(d.status||'').toUpperCase());
const activeIncident=i=>String(i.status||'OPEN').toUpperCase()!=='CLOSED';
const activeService=s=>String(s.status||'').toUpperCase()==='SCHEDULED';
const clean=s=>String(s??'').trim();

function expiryHealth(asset){
  const checks=[
    {key:'registrationExpiry',label:'Registration',date:asset.registrationExpiry},
    {key:'insuranceExpiry',label:'Insurance',date:asset.insuranceExpiry},
    {key:'coiDueDate',label:'Certificate of Inspection',date:asset.coiDueDate}
  ].map(x=>({...x,days:daysUntil(x.date)}));
  const red=checks.filter(x=>x.days===null||x.days<0);
  const yellow=checks.filter(x=>x.days!==null&&x.days>=0&&x.days<=30);
  return {status:red.length?'red':yellow.length?'yellow':'green',red,yellow,checks};
}
function employeeHealth(e){
  const c=e.compliance||{};
  const valid=v=>{const d=parseDate(v);return !!d&&d.getTime()>=Date.now()};
  const induction=!!c.induction?.complete&&!!c.induction?.signedOffDate;
  const licence=!!c.licence?.checked&&!!clean(e.licenceNo)&&valid(e.licenceExpiry);
  const medical=!!c.medical?.current&&!!c.medical?.reviewedDate&&(!c.medical?.expiryDate||valid(c.medical.expiryDate));
  const count=[induction,licence,medical].filter(Boolean).length;
  return {percent:count===3?100:count===2?67:count===1?33:0,checks:{induction,licence,medical}};
}
function complianceSummary(){
  const docs=compliance.list();
  let assigned=0,completed=0,overdue=0,opened=0;
  for(const doc of docs){
    for(const r of (doc.recipients||[])){
      assigned++;
      if(r.completedAt){completed++;continue}
      if(r.openedAt)opened++;
      if(doc.dueDate&&new Date(doc.dueDate+'T23:59:59').getTime()<Date.now())overdue++;
    }
  }
  return {documents:docs.length,assigned,completed,opened,overdue,outstanding:Math.max(0,assigned-completed),percent:assigned?Math.round(completed/assigned*100):100};
}
function serviceState(s){
  if(!activeService(s))return 'other';
  const d=daysUntil(s.requestedDate);
  if(d===null)return 'scheduled';
  if(d<0)return 'overdue';
  if(d<=7)return 'due7';
  if(d<=30)return 'due30';
  return 'scheduled';
}
function prestartTrend(prestarts){
  const rows=[];
  for(let i=6;i>=0;i--){
    const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);
    const k=dateKey(d),day=prestarts.filter(p=>String(p.completedAt||'').slice(0,10)===k);
    rows.push({date:k,label:d.toLocaleDateString('en-AU',{weekday:'short'}),total:day.length,passed:day.filter(p=>!String(p.status||'').toUpperCase().includes('FAIL')&&Number(p.failedCount||0)===0).length,failed:day.filter(p=>String(p.status||'').toUpperCase().includes('FAIL')||Number(p.failedCount||0)>0).length});
  }
  return rows;
}
function activityRows({prestarts,defects,serviceRows,incidentRows,docs}){
  const a=[];
  prestarts.forEach(x=>a.push({at:x.completedAt||x.createdAt,type:'prestart',title:`Pre-start ${x.status||'completed'}`,detail:`${x.rego||x.assetId||''} · ${x.inspector||'Driver'}`,href:'/prestart-history'}));
  defects.forEach(x=>a.push({at:x.updatedAt||x.reportedAt,type:'defect',title:`Defect ${x.status||'OPEN'}`,detail:`${x.rego||x.assetId||''} · ${x.defect||'Vehicle defect'}`,href:'/vehicle-defects'}));
  serviceRows.forEach(x=>a.push({at:x.updatedAt||x.createdAt||x.requestedDate,type:'service',title:`Service ${x.status||'scheduled'}`,detail:`${x.rego||x.assetId||''} · ${x.serviceType||'Service'}`,href:'/service'}));
  incidentRows.forEach(x=>a.push({at:x.updatedAt||x.createdAt||x.incidentDate,type:'incident',title:`Incident ${x.status||'OPEN'}`,detail:`${x.vehicleRego||x.vehicleId||''} · ${x.employeeName||''}`,href:'/incident-register'}));
  docs.forEach(x=>a.push({at:x.updatedAt||x.createdAt,type:'compliance',title:'Compliance document',detail:x.subject||x.category||'Compliance',href:'/compliance'}));
  return a.filter(x=>x.at).sort((x,y)=>new Date(y.at)-new Date(x.at)).slice(0,14);
}
function overview(){
  const prestarts=operations.listPrestarts();
  const defects=operations.listDefects();
  const serviceRows=services.list();
  const incidentRows=incidents.list();
  const docs=compliance.list();
  const activeAssets=assets.filter(a=>!['Retired','Sold','Decommissioned'].includes(String(a.status||'')));
  const expiry=activeAssets.map(a=>({asset:a,health:expiryHealth(a)}));
  const employeeRows=employees.map(e=>({employee:e,health:employeeHealth(e)}));
  const cmp=complianceSummary();
  const servicesOpen=serviceRows.filter(activeService);
  const counts={
    assets:assets.length,
    activeAssets:activeAssets.length,
    gpsLinked:activeAssets.filter(a=>a.wialonUnitId).length,
    currentDrivers:activeAssets.filter(a=>a.currentDriverEmployeeId).length,
    openDefects:defects.filter(activeDefect).length,
    highDefects:defects.filter(d=>activeDefect(d)&&String(d.priority||'').toUpperCase()==='HIGH').length,
    servicesOverdue:servicesOpen.filter(s=>serviceState(s)==='overdue').length,
    services7:servicesOpen.filter(s=>serviceState(s)==='due7').length,
    services30:servicesOpen.filter(s=>serviceState(s)==='due30').length,
    expiryRed:expiry.filter(x=>x.health.status==='red').length,
    expiryYellow:expiry.filter(x=>x.health.status==='yellow').length,
    expiryGreen:expiry.filter(x=>x.health.status==='green').length,
    employees:employees.length,
    employeesCompliant:employeeRows.filter(x=>x.health.percent===100).length,
    employeesAction:employeeRows.filter(x=>x.health.percent<100).length,
    employeeAverage:employeeRows.length?Math.round(employeeRows.reduce((n,x)=>n+x.health.percent,0)/employeeRows.length):100,
    incidentsOpen:incidentRows.filter(activeIncident).length,
    incidentsReview:incidentRows.filter(i=>String(i.status||'').toUpperCase()==='IN REVIEW').length,
    complianceOutstanding:cmp.outstanding,
    complianceOverdue:cmp.overdue,
    compliancePercent:cmp.percent,
    prestartsToday:prestarts.filter(p=>String(p.completedAt||'').slice(0,10)===dateKey(new Date())).length
  };
  const attention=[];
  expiry.filter(x=>x.health.status==='red').forEach(x=>{
    const issue=x.health.red[0];
    attention.push({tone:'red',icon:'expiry',title:`${x.asset.rego||x.asset.id} expiry action`,detail:issue.days===null?`${issue.label}: no date recorded`:`${issue.label}: ${Math.abs(issue.days)} day${Math.abs(issue.days)===1?'':'s'} overdue`,href:'/assets'});
  });
  servicesOpen.filter(s=>serviceState(s)==='overdue').forEach(s=>attention.push({tone:'red',icon:'service',title:`${s.rego||s.assetId} service overdue`,detail:`${s.serviceType||'Service'} · ${Math.abs(daysUntil(s.requestedDate)||0)} day(s) overdue`,href:'/service'}));
  defects.filter(d=>activeDefect(d)&&String(d.priority||'').toUpperCase()==='HIGH').forEach(d=>attention.push({tone:'red',icon:'defect',title:`High priority defect · ${d.rego||d.assetId}`,detail:d.defect||'Vehicle defect',href:'/vehicle-defects'}));
  incidentRows.filter(activeIncident).forEach(i=>attention.push({tone:'amber',icon:'incident',title:`Incident ${i.status||'OPEN'} · ${i.vehicleRego||i.vehicleId||''}`,detail:`${i.employeeName||'Employee'} · ${i.incidentDate||''}`,href:'/incident-register'}));
  if(cmp.overdue)attention.push({tone:'red',icon:'compliance',title:`${cmp.overdue} overdue compliance acknowledgement${cmp.overdue===1?'':'s'}`,detail:`${cmp.outstanding} total outstanding acknowledgement${cmp.outstanding===1?'':'s'}`,href:'/compliance'});
  employeeRows.filter(x=>x.health.percent<100).slice(0,5).forEach(x=>attention.push({tone:'amber',icon:'people',title:`${[x.employee.firstName,x.employee.lastName].filter(Boolean).join(' ')||x.employee.id} compliance ${x.health.percent}%`,detail:'Staff compliance health check requires attention',href:'/employees'}));
  const upcoming=servicesOpen.sort((a,b)=>String(a.requestedDate).localeCompare(String(b.requestedDate))).slice(0,7).map(s=>({...s,state:serviceState(s),days:daysUntil(s.requestedDate)}));
  return {
    generatedAt:new Date().toISOString(),counts,compliance:cmp,
    prestartTrend:prestartTrend(prestarts),
    defectPriority:{high:defects.filter(d=>activeDefect(d)&&String(d.priority||'').toUpperCase()==='HIGH').length,medium:defects.filter(d=>activeDefect(d)&&String(d.priority||'').toUpperCase()==='MEDIUM').length,low:defects.filter(d=>activeDefect(d)&&String(d.priority||'').toUpperCase()==='LOW').length},
    drivers:activeAssets.filter(a=>a.currentDriverEmployeeId).map(a=>({assetId:a.id,rego:a.rego,name:a.name,driver:a.currentDriverName,gpsState:a.driverGpsState||'assigned',assignedAt:a.driverLatchedAt||''})).slice(0,8),
    upcomingServices:upcoming,
    attention:attention.slice(0,14),
    activity:activityRows({prestarts,defects,serviceRows,incidentRows,docs})
  };
}

router.get('/api/dashboard/overview',(req,res)=>{res.set('Cache-Control','no-store');res.json(overview())});

router.get('/dashboard',(req,res)=>res.send(page('dashboard','Dashboard',`
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
<style>
:root{--dashInk:#142033;--dashMute:#738095;--dashLine:#e4eaf0;--dashBlue:#2478d3;--dashCyan:#31c6ed;--dashGreen:#1f9f62;--dashAmber:#d49620;--dashRed:#c53b3b;--dashNavy:#0c1522}
.dash{max-width:1500px;margin:0 auto;padding-bottom:30px}.dashHero{position:relative;overflow:hidden;border-radius:20px;padding:24px 26px;margin-bottom:18px;color:#fff;background:linear-gradient(125deg,#0b1421 0%,#14283d 58%,#164968 100%);box-shadow:0 18px 45px rgba(12,21,34,.18)}.dashHero:before{content:"";position:absolute;width:360px;height:360px;border-radius:50%;right:-120px;top:-190px;background:radial-gradient(circle,rgba(74,208,245,.25),transparent 68%)}.dashHero:after{content:"";position:absolute;inset:auto 0 0 0;height:1px;background:linear-gradient(90deg,transparent,rgba(80,212,247,.65),transparent)}.dashHeroTop{position:relative;z-index:1;display:flex;justify-content:space-between;gap:22px;align-items:flex-start}.dashEyebrow{font-size:10px;letter-spacing:1.3px;text-transform:uppercase;font-weight:900;color:#76d9f4}.dashHero h1{margin:6px 0 7px;font-size:30px;letter-spacing:-.7px}.dashHero p{margin:0;color:#aebdcd;font-size:12px}.heroStatus{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.statusChip{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);padding:8px 10px;border-radius:999px;font-size:10px;font-weight:800;color:#d7e1eb}.statusDot{width:8px;height:8px;border-radius:50%;background:#78889c}.statusDot.ok{background:#31d47d;box-shadow:0 0 0 4px rgba(49,212,125,.13)}.statusDot.bad{background:#ff6b6b}.quickRail{position:relative;z-index:1;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:20px}.quickAction{min-height:70px;text-decoration:none;color:#eaf2f8;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.045);border-radius:13px;padding:11px;display:flex;align-items:center;gap:10px;transition:.16s}.quickAction:hover{background:rgba(255,255,255,.09);transform:translateY(-1px)}.quickIcon,.kpiIcon,.attentionIcon,.activityIcon{display:grid;place-items:center;flex:0 0 auto}.quickIcon{width:34px;height:34px;border-radius:10px;background:rgba(55,199,242,.12);color:#51cef2}.quickIcon svg,.kpiIcon svg,.attentionIcon svg,.activityIcon svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.quickAction b{display:block;font-size:11px}.quickAction span{display:block;color:#8497aa;font-size:9px;margin-top:2px}
.kpiGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}.kpi{position:relative;overflow:hidden;background:#fff;border:1px solid var(--dashLine);border-radius:15px;padding:16px;min-height:125px;box-shadow:0 6px 20px rgba(26,39,55,.035)}.kpiTop{display:flex;align-items:center;justify-content:space-between;gap:10px}.kpiIcon{width:38px;height:38px;border-radius:11px;background:#eef5fc;color:#2478d3}.kpi.red .kpiIcon{background:#fff0f0;color:#c53b3b}.kpi.amber .kpiIcon{background:#fff7e9;color:#bf7e0c}.kpi.green .kpiIcon{background:#edf9f2;color:#1e965d}.kpiLabel{font-size:9px;text-transform:uppercase;letter-spacing:.75px;color:#8190a3;font-weight:900}.kpiValue{font-size:29px;line-height:1;font-weight:900;color:var(--dashInk);margin-top:12px;letter-spacing:-.8px}.kpiSub{margin-top:8px;color:#738095;font-size:10px;display:flex;gap:8px;flex-wrap:wrap}.kpiSub b{color:#425268}.kpiLink{position:absolute;inset:0}
.dashboardGrid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:12px;margin-bottom:12px}.panelDash{background:#fff;border:1px solid var(--dashLine);border-radius:15px;overflow:hidden;box-shadow:0 6px 20px rgba(26,39,55,.03)}.panelHead{padding:15px 16px;border-bottom:1px solid #edf1f5;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.panelHead h2{font-size:14px;margin:0;color:#1b293a}.panelHead p{font-size:9px;color:#8793a3;margin:3px 0 0}.panelLink{font-size:9px;font-weight:900;color:#2478d3;text-decoration:none;white-space:nowrap}.panelBody{padding:16px}
.riskLayout{display:grid;grid-template-columns:160px 1fr;align-items:center;gap:18px}.donut{--green:0;--yellow:0;--red:0;width:142px;height:142px;border-radius:50%;background:conic-gradient(#d94141 0 calc(var(--red)*1%),#e3a229 calc(var(--red)*1%) calc((var(--red) + var(--yellow))*1%),#29a96a calc((var(--red) + var(--yellow))*1%) 100%);position:relative;display:grid;place-items:center;margin:auto}.donut:after{content:"";position:absolute;width:96px;height:96px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 1px #edf1f5}.donutCenter{position:relative;z-index:1;text-align:center}.donutCenter b{font-size:25px;display:block}.donutCenter span{font-size:9px;color:#8895a5;text-transform:uppercase;font-weight:900}.legendRows{display:grid;gap:9px}.legendRow{display:grid;grid-template-columns:10px 1fr auto;gap:9px;align-items:center;font-size:10px}.legendDot{width:9px;height:9px;border-radius:50%}.legendDot.red{background:#d94141}.legendDot.amber{background:#e3a229}.legendDot.green{background:#29a96a}.legendRow span{color:#6f7d8f}.legendRow b{font-size:12px}
.trendChart{height:165px;display:flex;align-items:flex-end;gap:8px;padding:14px 3px 0}.trendDay{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:6px}.trendBars{height:120px;width:100%;display:flex;align-items:flex-end;justify-content:center;gap:3px}.trendBar{width:min(18px,42%);min-height:3px;border-radius:5px 5px 2px 2px}.trendBar.pass{background:linear-gradient(#42c47e,#269b61)}.trendBar.fail{background:linear-gradient(#ef7676,#c93e3e)}.trendLabel{font-size:9px;color:#7e8a9b;font-weight:800}.trendCount{font-size:8px;color:#98a3b1}
.priorityRows{display:grid;gap:13px;margin-top:6px}.priorityRow{display:grid;grid-template-columns:60px 1fr 28px;gap:9px;align-items:center}.priorityRow label{font-size:9px;font-weight:900;color:#667487;text-transform:uppercase}.priorityTrack{height:8px;border-radius:99px;background:#edf1f5;overflow:hidden}.priorityFill{height:100%;border-radius:99px}.priorityFill.high{background:#d94141}.priorityFill.medium{background:#dfa028}.priorityFill.low{background:#3185da}.priorityRow b{text-align:right;font-size:11px}
.opsGrid{display:grid;grid-template-columns:1.45fr 1fr;gap:12px;margin-bottom:12px}.mapPanel{min-height:420px}.miniMap{height:315px;background:#e8edf2}.mapStats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px;border-top:1px solid #edf1f5}.mapStat{padding:9px;border-radius:9px;background:#f7f9fb}.mapStat span{display:block;font-size:8px;text-transform:uppercase;color:#8794a5;font-weight:850}.mapStat b{display:block;font-size:15px;margin-top:3px}.liveMarker{width:19px;height:19px;border-radius:50%;background:#2d80d7;border:3px solid #fff;box-shadow:0 2px 8px #0004}.liveMarker.moving{background:#24a765;box-shadow:0 0 0 5px rgba(36,167,101,.15),0 2px 8px #0004}
.serviceList,.driverList,.attentionList,.activityList{display:grid}.serviceRow,.driverRow,.attentionRow,.activityRow{display:grid;align-items:center;border-bottom:1px solid #edf1f5}.serviceRow:last-child,.driverRow:last-child,.attentionRow:last-child,.activityRow:last-child{border-bottom:0}.serviceRow{grid-template-columns:10px 1fr auto;gap:10px;padding:11px 0}.serviceTone{width:8px;height:36px;border-radius:99px;background:#3a9b66}.serviceTone.overdue{background:#d94141}.serviceTone.due7,.serviceTone.due30{background:#dfa028}.rowTitle{font-size:11px;font-weight:850;color:#29384b}.rowSub{font-size:9px;color:#8390a0;margin-top:3px}.rowMetric{text-align:right;font-size:9px;color:#758296}.rowMetric b{display:block;font-size:11px;color:#334256}
.driverRow{grid-template-columns:36px 1fr auto;gap:10px;padding:10px 0}.driverAvatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#edf5fb;color:#2776c9;font-size:10px;font-weight:900}.driverState{font-size:8px;font-weight:900;text-transform:uppercase;padding:5px 7px;border-radius:999px;background:#edf1f5;color:#677586}.driverState.moving{background:#e8f7ef;color:#1b8954}.driverState.stationary{background:#fff6e5;color:#a96d09}
.bottomGrid{display:grid;grid-template-columns:1.1fr .9fr;gap:12px}.attentionRow{grid-template-columns:38px 1fr auto;gap:10px;padding:11px 0;text-decoration:none}.attentionIcon{width:36px;height:36px;border-radius:10px;background:#f1f4f7;color:#607087}.attentionRow.red .attentionIcon{background:#fff0f0;color:#c53b3b}.attentionRow.amber .attentionIcon{background:#fff7e9;color:#bd7c0a}.attentionArrow{color:#9ba6b3}.activityRow{grid-template-columns:34px 1fr auto;gap:10px;padding:10px 0;text-decoration:none}.activityIcon{width:32px;height:32px;border-radius:9px;background:#f1f5f9;color:#52657b}.activityTime{font-size:8px;color:#99a4b2;white-space:nowrap}.emptyDash{padding:25px;text-align:center;color:#8b97a6;font-size:10px}
@media(max-width:1200px){.quickRail{grid-template-columns:repeat(3,1fr)}.kpiGrid{grid-template-columns:repeat(2,1fr)}.dashboardGrid{grid-template-columns:1fr 1fr}.dashboardGrid .panelDash:first-child{grid-column:1/-1}.opsGrid,.bottomGrid{grid-template-columns:1fr}}
@media(max-width:760px){.dashHero{padding:20px}.dashHeroTop{flex-direction:column}.heroStatus{justify-content:flex-start}.quickRail{grid-template-columns:1fr 1fr}.kpiGrid,.dashboardGrid{grid-template-columns:1fr}.dashboardGrid .panelDash:first-child{grid-column:auto}.riskLayout{grid-template-columns:1fr}.mapStats{grid-template-columns:1fr 1fr}.kpi{min-height:110px}}
</style>
<div class="dash">
<section class="dashHero">
  <div class="dashHeroTop"><div><div class="dashEyebrow">Owner & Operations Command Centre</div><h1 id="dashGreeting">Supervisor365 Dashboard</h1><p id="dashGenerated">Loading operational snapshot…</p></div><div class="heroStatus"><span class="statusChip"><span id="wialonDot" class="statusDot"></span><span id="wialonText">Wialon checking…</span></span><span class="statusChip"><span class="statusDot ok"></span>Build data active</span></div></div>
  <div class="quickRail">
    <a class="quickAction" href="/prestarts"><span class="quickIcon">${icon('check')}</span><span><b>Start Pre-Start</b><span>Begin inspection</span></span></a>
    <a class="quickAction" href="/assets?quick=addAsset"><span class="quickIcon">${icon('truck')}</span><span><b>Add Asset</b><span>Fleet register</span></span></a>
    <a class="quickAction" href="/employees?quick=addEmployee"><span class="quickIcon">${icon('people')}</span><span><b>Add Employee</b><span>People register</span></span></a>
    <a class="quickAction" href="/incident-register/new"><span class="quickIcon">${icon('alert')}</span><span><b>Report Incident</b><span>Safety event</span></span></a>
    <a class="quickAction" href="/service"><span class="quickIcon">${icon('wrench')}</span><span><b>Schedule Service</b><span>Maintenance plan</span></span></a>
    <a class="quickAction" href="/gps"><span class="quickIcon">${icon('pin')}</span><span><b>Live Fleet</b><span>GPS operations</span></span></a>
  </div>
</section>

<section class="kpiGrid">
 ${kpi('Fleet Assets','kpiAssets','Active / GPS linked','truck','blue','/assets')}
 ${kpi('Current Drivers','kpiDrivers','Assigned to assets','people','green','/gps')}
 ${kpi('Open Defects','kpiDefects','High priority','alert','red','/vehicle-defects')}
 ${kpi('Service Risk','kpiService','Overdue / due soon','wrench','amber','/service')}
 ${kpi('Asset Expiry Risk','kpiExpiry','Red / yellow / green','calendar','red','/assets')}
 ${kpi('People Compliance','kpiPeople','100% compliant','shield','green','/employees')}
 ${kpi('Open Incidents','kpiIncidents','Safety register','clipboard','amber','/incident-register')}
 ${kpi('Compliance','kpiCompliance','Acknowledgement completion','document','green','/compliance')}
</section>

<section class="dashboardGrid">
 <article class="panelDash"><div class="panelHead"><div><h2>Asset Expiry Health</h2><p>Registration, insurance and Certificate of Inspection</p></div><a class="panelLink" href="/assets">Open Assets →</a></div><div class="panelBody"><div class="riskLayout"><div class="donut" id="expiryDonut"><div class="donutCenter"><b id="riskTotal">0</b><span>Active assets</span></div></div><div class="legendRows"><div class="legendRow"><span class="legendDot red"></span><span>Expired / missing date</span><b id="riskRed">0</b></div><div class="legendRow"><span class="legendDot amber"></span><span>Expires within 30 days</span><b id="riskYellow">0</b></div><div class="legendRow"><span class="legendDot green"></span><span>Within expiry range</span><b id="riskGreen">0</b></div></div></div></div></article>
 <article class="panelDash"><div class="panelHead"><div><h2>Pre-Start Activity</h2><p>Last 7 days · passed versus failed</p></div><a class="panelLink" href="/prestart-history">History →</a></div><div class="panelBody"><div class="trendChart" id="prestartTrend"></div></div></article>
 <article class="panelDash"><div class="panelHead"><div><h2>Defect Priority</h2><p>Outstanding fleet defects</p></div><a class="panelLink" href="/vehicle-defects">Defects →</a></div><div class="panelBody"><div class="priorityRows" id="defectPriority"></div></div></article>
</section>

<section class="opsGrid">
 <article class="panelDash mapPanel"><div class="panelHead"><div><h2>Live Fleet Operations</h2><p>Current Wialon-linked fleet positions</p></div><a class="panelLink" href="/gps">Open Live GPS →</a></div><div id="dashMap" class="miniMap"></div><div class="mapStats"><div class="mapStat"><span>Visible GPS</span><b id="gpsVisible">0</b></div><div class="mapStat"><span>Moving</span><b id="gpsMoving">0</b></div><div class="mapStat"><span>Stationary</span><b id="gpsStationary">0</b></div><div class="mapStat"><span>Current Drivers</span><b id="gpsDrivers">0</b></div></div></article>
 <div style="display:grid;gap:12px">
   <article class="panelDash"><div class="panelHead"><div><h2>Upcoming Service</h2><p>Next maintenance deadlines</p></div><a class="panelLink" href="/service">Schedule →</a></div><div class="panelBody"><div id="serviceList" class="serviceList"></div></div></article>
   <article class="panelDash"><div class="panelHead"><div><h2>Current Drivers</h2><p>Employees latched by completed pre-start</p></div><a class="panelLink" href="/assets">Assets →</a></div><div class="panelBody"><div id="driverList" class="driverList"></div></div></article>
 </div>
</section>

<section class="bottomGrid">
 <article class="panelDash"><div class="panelHead"><div><h2>Attention Required</h2><p>Highest priority operational and compliance actions</p></div><span class="panelLink" id="attentionCount"></span></div><div class="panelBody"><div id="attentionList" class="attentionList"></div></div></article>
 <article class="panelDash"><div class="panelHead"><div><h2>Recent Activity</h2><p>Latest changes across Supervisor365</p></div><span class="panelLink">Live feed</span></div><div class="panelBody"><div id="activityList" class="activityList"></div></div></article>
</section>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>(()=>{const $=id=>document.getElementById(id);const icons=${JSON.stringify(iconMap())};let map=null,mapMarkers=[];const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));const fmtTime=v=>{if(!v)return'';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('en-AU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):''};function greeting(){const h=new Date().getHours(),g=h<12?'Good morning':h<18?'Good afternoon':'Good evening';$('dashGreeting').textContent=g+' · Operations Overview'}greeting();function setKpi(id,value,sub){const el=$(id);if(!el)return;el.querySelector('.kpiValue').textContent=value;el.querySelector('.kpiSub').innerHTML=sub}function bars(d){const max=Math.max(1,...d.map(x=>x.total));$('prestartTrend').innerHTML=d.map(x=>'<div class="trendDay"><div class="trendBars"><div class="trendBar pass" title="'+x.passed+' passed" style="height:'+Math.max(x.passed?7:2,Math.round(x.passed/max*100))+'%"></div><div class="trendBar fail" title="'+x.failed+' failed" style="height:'+Math.max(x.failed?7:2,Math.round(x.failed/max*100))+'%"></div></div><div class="trendLabel">'+esc(x.label)+'</div><div class="trendCount">'+x.total+'</div></div>').join('')}function priorities(p){const max=Math.max(1,p.high,p.medium,p.low);$('defectPriority').innerHTML=[['High',p.high,'high'],['Medium',p.medium,'medium'],['Low',p.low,'low']].map(x=>'<div class="priorityRow"><label>'+x[0]+'</label><div class="priorityTrack"><div class="priorityFill '+x[2]+'" style="width:'+Math.round(x[1]/max*100)+'%"></div></div><b>'+x[1]+'</b></div>').join('')}function servicesHtml(rows){$('serviceList').innerHTML=rows.length?rows.map(x=>'<div class="serviceRow"><span class="serviceTone '+esc(x.state)+'"></span><div><div class="rowTitle">'+esc(x.rego||x.assetId)+' · '+esc(x.serviceType||'Service')+'</div><div class="rowSub">'+esc(x.serviceCentre||'No service centre recorded')+'</div></div><div class="rowMetric"><b>'+esc(x.requestedDate||'—')+'</b>'+(x.days<0?Math.abs(x.days)+'d overdue':x.days===0?'Today':x.days!=null?'In '+x.days+'d':'')+'</div></div>').join(''):'<div class="emptyDash">No upcoming services scheduled.</div>'}function driversHtml(rows){$('driverList').innerHTML=rows.length?rows.map(x=>'<div class="driverRow"><div class="driverAvatar">'+esc(String(x.driver||'?').split(/\s+/).map(y=>y[0]).join('').slice(0,2).toUpperCase())+'</div><div><div class="rowTitle">'+esc(x.driver||'Assigned driver')+'</div><div class="rowSub">'+esc(x.rego||x.assetId)+' · '+esc(x.name||'')+'</div></div><span class="driverState '+esc(x.gpsState)+'">'+esc(x.gpsState||'assigned')+'</span></div>').join(''):'<div class="emptyDash">No drivers are currently latched to assets.</div>'}function attentionHtml(rows){$('attentionCount').textContent=rows.length?rows.length+' action'+(rows.length===1?'':'s'):'';$('attentionList').innerHTML=rows.length?rows.map(x=>'<a class="attentionRow '+esc(x.tone)+'" href="'+esc(x.href)+'"><span class="attentionIcon">'+(icons[x.icon]||icons.alert)+'</span><span><span class="rowTitle">'+esc(x.title)+'</span><span class="rowSub">'+esc(x.detail)+'</span></span><span class="attentionArrow">›</span></a>').join(''):'<div class="emptyDash">No urgent actions. Everything is looking healthy.</div>'}function activityHtml(rows){$('activityList').innerHTML=rows.length?rows.map(x=>'<a class="activityRow" href="'+esc(x.href)+'"><span class="activityIcon">'+(icons[x.type]||icons.document)+'</span><span><span class="rowTitle">'+esc(x.title)+'</span><span class="rowSub">'+esc(x.detail)+'</span></span><span class="activityTime">'+esc(fmtTime(x.at))+'</span></a>').join(''):'<div class="emptyDash">No recent activity yet.</div>'}async function loadOverview(){try{const r=await fetch('/api/dashboard/overview',{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load dashboard');const c=d.counts;$('dashGenerated').textContent='Operational snapshot updated '+new Date(d.generatedAt).toLocaleString('en-AU');setKpi('kpiAssets',c.assets,'<b>'+c.activeAssets+'</b> active · <b>'+c.gpsLinked+'</b> GPS linked');setKpi('kpiDrivers',c.currentDrivers,'<b>'+c.currentDrivers+'</b> currently assigned · <b>'+c.prestartsToday+'</b> pre-starts today');setKpi('kpiDefects',c.openDefects,'<b>'+c.highDefects+'</b> high priority');setKpi('kpiService',c.servicesOverdue,'<b>'+c.servicesOverdue+'</b> overdue · <b>'+c.services7+'</b> due ≤7d · <b>'+c.services30+'</b> due ≤30d');setKpi('kpiExpiry',c.expiryRed,'<b>'+c.expiryRed+'</b> red · <b>'+c.expiryYellow+'</b> yellow · <b>'+c.expiryGreen+'</b> green');setKpi('kpiPeople',c.employeeAverage+'%','<b>'+c.employeesCompliant+'</b> fully compliant · <b>'+c.employeesAction+'</b> action required');setKpi('kpiIncidents',c.incidentsOpen,'<b>'+c.incidentsReview+'</b> in review');setKpi('kpiCompliance',c.compliancePercent+'%','<b>'+c.complianceOutstanding+'</b> outstanding · <b>'+c.complianceOverdue+'</b> overdue');const total=Math.max(1,c.expiryRed+c.expiryYellow+c.expiryGreen),red=Math.round(c.expiryRed/total*100),yellow=Math.round(c.expiryYellow/total*100);$('expiryDonut').style.setProperty('--red',red);$('expiryDonut').style.setProperty('--yellow',yellow);$('expiryDonut').style.setProperty('--green',100-red-yellow);$('riskTotal').textContent=c.activeAssets;$('riskRed').textContent=c.expiryRed;$('riskYellow').textContent=c.expiryYellow;$('riskGreen').textContent=c.expiryGreen;bars(d.prestartTrend||[]);priorities(d.defectPriority||{high:0,medium:0,low:0});servicesHtml(d.upcomingServices||[]);driversHtml(d.drivers||[]);$('gpsDrivers').textContent=c.currentDrivers;attentionHtml(d.attention||[]);activityHtml(d.activity||[])}catch(e){$('dashGenerated').textContent=e.message}}async function loadGps(){try{const [sr,gr]=await Promise.all([fetch('/api/gps/wialon/status',{cache:'no-store'}),fetch('/api/gps/live',{cache:'no-store'})]),s=await sr.json(),g=await gr.json();if(s.configured){$('wialonDot').className='statusDot ok';$('wialonText').textContent='Wialon connected'+(s.user?' · '+s.user:'')}else{$('wialonDot').className='statusDot bad';$('wialonText').textContent='Wialon not connected'}const rows=gr.ok&&Array.isArray(g)?g.filter(x=>x.unit&&x.unit.position):[];$('gpsVisible').textContent=rows.length;const moving=rows.filter(x=>Number(x.unit.position.speed)>2).length;$('gpsMoving').textContent=moving;$('gpsStationary').textContent=Math.max(0,rows.length-moving);if(!map){map=L.map('dashMap',{zoomControl:false,attributionControl:false}).setView([-27.47,153.03],9);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map)}mapMarkers.forEach(m=>map.removeLayer(m));mapMarkers=[];rows.forEach(x=>{const p=x.unit.position,moving=Number(p.speed)>2,m=L.marker([p.lat,p.lon],{icon:L.divIcon({className:'',html:'<div class="liveMarker '+(moving?'moving':'')+'"></div>',iconSize:[19,19],iconAnchor:[9,9]})}).bindTooltip('<b>'+esc(x.rego||x.assetId)+'</b><br>'+esc(x.name)+'<br>'+Math.round(Number(p.speed)||0)+' km/h');m.addTo(map);mapMarkers.push(m)});if(mapMarkers.length===1)map.setView(mapMarkers[0].getLatLng(),14);else if(mapMarkers.length>1)map.fitBounds(L.latLngBounds(mapMarkers.map(m=>m.getLatLng())),{padding:[30,30],maxZoom:13})}catch(e){$('wialonDot').className='statusDot bad';$('wialonText').textContent='Wialon unavailable';if(!map){map=L.map('dashMap',{zoomControl:false,attributionControl:false}).setView([-27.47,153.03],9);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map)}}}loadOverview();loadGps();setInterval(loadOverview,60000);setInterval(loadGps,10000);setTimeout(()=>map&&map.invalidateSize(),250)})();</script>
`)));

function icon(name){return iconMap()[name]||iconMap().document}
function iconMap(){return{
  truck:'<svg viewBox="0 0 24 24"><path d="M3 6h11v11H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  people:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 15.5a4.5 4.5 0 0 1 6.5 4"/></svg>',
  alert:'<svg viewBox="0 0 24 24"><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".8"/></svg>',
  wrench:'<svg viewBox="0 0 24 24"><path d="M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-4-4z"/></svg>',
  calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  shield:'<svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6z"/><path d="m9 12 2 2 4-5"/></svg>',
  clipboard:'<svg viewBox="0 0 24 24"><path d="M6 4h12v17H6z"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/></svg>',
  document:'<svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></svg>',
  check:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  pin:'<svg viewBox="0 0 24 24"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>',
  expiry:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M12 13v3M12 19h.01"/></svg>',
  service:'<svg viewBox="0 0 24 24"><path d="M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-4-4z"/></svg>',
  defect:'<svg viewBox="0 0 24 24"><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".8"/></svg>',
  incident:'<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="M16 13v5M13.5 15.5h5"/></svg>',
  compliance:'<svg viewBox="0 0 24 24"><path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h3"/><path d="m14.5 16 1.5 1.5 3-3"/></svg>',
  prestart:'<svg viewBox="0 0 24 24"><path d="M6 4h12v17H6z"/><path d="m9 10 1.5 1.5L14 8M9 16h6"/></svg>'
}}
function kpi(label,id,sub,iconName,tone,href){return`<article class="kpi ${tone||''}" id="${id}"><div class="kpiTop"><div><div class="kpiLabel">${label}</div></div><span class="kpiIcon">${icon(iconName)}</span></div><div class="kpiValue">—</div><div class="kpiSub">${sub}</div><a class="kpiLink" href="${href}" aria-label="${label}"></a></article>`}

module.exports=router;

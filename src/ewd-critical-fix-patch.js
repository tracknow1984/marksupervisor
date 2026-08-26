const express=require('express');
const {assets,employees}=require('./store');
const operations=require('./persistent-store');
const ewd=require('./ewd-store');
const rules=require('./ewd-rule-engine');

const DAY=86400000;
const clean=v=>String(v??'').trim();
const ms=v=>{const n=new Date(v||0).getTime();return Number.isFinite(n)?n:0};
const employeeName=e=>[e?.firstName,e?.lastName].filter(Boolean).join(' ').trim()||e?.email||e?.id||'Driver';

function prestartEligible(asset,employeeId){
  if(!asset||String(asset.currentDriverEmployeeId||'')!==String(employeeId||''))return null;
  const p=asset.driverPrestartId?operations.getPrestart(asset.driverPrestartId):null;
  if(!p||p.status!=='Passed'||!p.isPrimary)return null;
  if(Date.now()-ms(p.completedAt)>DAY)return null;
  return p;
}
function tripSummary(s){
  const t=rules.tripTotals(s.events||[],s.startedAt,s.endedAt),gpsKm=rules.gpsDistanceKm(s.gps||[]),events=(s.events||[]).filter(x=>['Work','Rest'].includes(x.eventType));
  const first=events.find(x=>Number.isFinite(Number(x.odometer))),last=[...events].reverse().find(x=>Number.isFinite(Number(x.odometer)));
  const odo=first&&last&&Number(last.odometer)>=Number(first.odometer)?Math.round(Number(last.odometer)-Number(first.odometer)):null;
  return{...t,distanceKm:odo??gpsKm,gpsDistanceKm:gpsKm,odometerDistanceKm:odo,breaks:events.filter(x=>x.eventType==='Rest').length,workChanges:events.filter(x=>x.eventType==='Work').length,alerts:(s.alerts||[]).length,potentialNonCompliance:rules.analyse(s.events||[],s.workRestOption,s.endedAt||new Date().toISOString()).potentialNonCompliance.length,gpsPoints:(s.gps||[]).length};
}
function enriched(s){return{...s,fatigue:rules.analyse(s.events||[],s.workRestOption,s.endedAt||new Date().toISOString()),summary:tripSummary(s)}}
function eligibleAssignments(employeeId=''){
  return assets.filter(a=>a.currentDriverEmployeeId&&(!employeeId||String(a.currentDriverEmployeeId)===String(employeeId))).map(a=>{
    const emp=employees.find(e=>String(e.id)===String(a.currentDriverEmployeeId)),p=prestartEligible(a,a.currentDriverEmployeeId);
    if(!emp||!p)return null;
    const active=ewd.getActiveSession(emp.id);
    return{assetId:a.id,assetName:a.name,rego:a.rego,assetType:a.type,odometer:Number(a.reading)||0,employeeId:emp.id,driverName:employeeName(emp),licenceNumber:emp.licenceNo||'',licenceState:emp.licenceState||'',prestartId:p.id,prestartCompletedAt:p.completedAt,prestartLocation:p.address||p.location||'',hasPin:ewd.hasPin(emp.id),activeSessionId:active&&String(active.assetId)===String(a.id)?active.id:''};
  }).filter(Boolean);
}
function exportShape(s){
  const eventComments=(s.events||[]).filter(x=>x.comment).map(x=>({comment:x.comment,timestamp:x.timestamp}));
  const quickComments=(s.driverComments||[]).filter(x=>x.comment).map(x=>({comment:x.comment,timestamp:x.timestamp}));
  return{technologyProviderId:'Supervisor365 Candidate - NOT NHVR APPROVED',driverInfo:{driverId:s.driverId,driverLicenceIssued:s.licenceState||'OTH',driverLicenceNumber:s.licenceNumber||'',driverName:s.driverName},numberPlateEvents:[{newNumberPlate:s.rego,timestamp:s.startedAt}],twoUpEvents:s.twoUpEvents||[],workRestEvents:(s.events||[]).filter(x=>['Work','Rest'].includes(x.eventType)).map(x=>({eventType:x.eventType,historicData:!!x.historicData,location:x.location,odometer:x.odometer,startTime:x.startTime,timestamp:x.timestamp})),workRestOptionEvents:[{workRestOption:s.workRestOption,timestamp:s.startedAt}],comments:[...eventComments,...quickComments].sort((a,b)=>ms(a.timestamp)-ms(b.timestamp)),authorisedOfficerAnnotations:s.annotations||[]};
}

const preRouter=express.Router();
preRouter.get('/api/ewd/bootstrap',(req,res)=>{
  const employeeId=clean(req.query.employeeId),eligible=eligibleAssignments(employeeId),activeSessions=ewd.listSessions().filter(s=>s.status==='ACTIVE');
  let active=employeeId?ewd.getActiveSession(employeeId):null;
  // With no app-level authentication yet, auto-resume only where there is exactly one active EWD.
  if(!active&&!employeeId&&activeSessions.length===1)active=activeSessions[0];
  const historyEmployee=employeeId||active?.employeeId||'';
  const since=Date.now()-28*DAY;
  const history=historyEmployee?ewd.sessionsForDriver(historyEmployee,since).slice(-10).reverse().map(s=>({id:s.id,startedAt:s.startedAt,endedAt:s.endedAt,status:s.status,rego:s.rego,driverName:s.driverName,summary:tripSummary(s)})):[];
  res.set('Cache-Control','no-store');
  res.json({candidate:true,approvalStatus:'NOT_NHVR_APPROVED',eligible,active:active?enriched(active):null,history});
});
preRouter.get('/api/ewd/session/:id/export',(req,res,next)=>{
  const s=ewd.getSession(req.params.id);if(!s)return next();
  res.set('Cache-Control','no-store');
  res.set('Content-Disposition',`attachment; filename="${s.id}-ewd.json"`);
  res.json(exportShape(s));
});

if(!express.__sv365EwdCriticalPreflight){
  express.__sv365EwdCriticalPreflight=true;
  const previousJson=express.json;
  express.json=function(...args){
    const parser=previousJson(...args);
    return function sv365JsonWithEwdCritical(req,res,next){parser(req,res,err=>err?next(err):preRouter(req,res,next))};
  };
}

if(!express.response.__sv365EwdCriticalHtml){
  express.response.__sv365EwdCriticalHtml=true;
  const originalSend=express.response.send;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('id="activeEwd"')&&body.includes('id="startEwdBtn"')){
      // Respect a pre-start supplied location even if GPS is not yet available.
      body=body.replace("$('sLocation').value=x.prestartLocation||gps?gps.coords.latitude.toFixed(5)+', '+gps.coords.longitude.toFixed(5):'';","$('sLocation').value=x.prestartLocation||(gps?gps.coords.latitude.toFixed(5)+', '+gps.coords.longitude.toFixed(5):'');");
      // Always retain the human-readable location the driver confirms/edits, while keeping GNSS coordinates as metadata.
      body=body.replace("odometer:Number($('sOdo').value),startTime:fromLocal($('sStart').value,$('sOffset').value),timestamp:stamp(Date.now(),$('sOffset').value),...g","odometer:Number($('sOdo').value),startTime:fromLocal($('sStart').value,$('sOffset').value),timestamp:stamp(Date.now(),$('sOffset').value),...g,locationName:$('sLocation').value");
      body=body.replace("locationName:$('cLocation').value,...currentGpsBody(),comment:$('cComment').value","...currentGpsBody(),locationName:$('cLocation').value,comment:$('cComment').value");
      body=body.replace("locationName:$('mLocation').value,...currentGpsBody(),comment:$('mComment').value","...currentGpsBody(),locationName:$('mLocation').value,comment:$('mComment').value");
      body=body.replace("locationName:$('eLocation').value,...currentGpsBody(),timestamp:stamp()","...currentGpsBody(),locationName:$('eLocation').value,timestamp:stamp()");
      // If the selected driver already has an active EWD, resume it instead of opening a second start flow.
      body=body.replace("document.querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>prepareStart(rows[Number(b.dataset.assign)]))","document.querySelectorAll('[data-assign]').forEach(b=>b.onclick=async()=>{const x=rows[Number(b.dataset.assign)];if(x.activeSessionId){const br=await fetch('/api/ewd/bootstrap?employeeId='+encodeURIComponent(x.employeeId),{cache:'no-store'}),bd=await br.json();if(br.ok&&bd.active){data=bd;session=bd.active;qs.set('employee',x.employeeId);history.replaceState({},'',location.pathname+'?'+qs);showActive();return}}prepareStart(x)})");
    }
    return originalSend.call(this,body);
  };
}

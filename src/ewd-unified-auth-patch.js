const express=require('express');
const {assets,employees}=require('./store');
const operations=require('./persistent-store');
const ewd=require('./ewd-store');
const rules=require('./ewd-rule-engine');

const router=express.Router();
const clean=v=>String(v??'').trim();
const n=v=>Number.isFinite(Number(v))?Number(v):null;
const ms=v=>{const x=new Date(v||0).getTime();return Number.isFinite(x)?x:0};
const nowIso=()=>new Date().toISOString();
const employeeName=e=>[e?.firstName,e?.lastName].filter(Boolean).join(' ').trim()||e?.email||String(e?.id||'Driver');
const uid=e=>'SV365-'+String(e?.id||'UNKNOWN').replace(/[^A-Za-z0-9_-]/g,'').toUpperCase();
const allowedOptions=['Standard','BFM'];

function prestartEligible(asset,employeeId){
  if(!asset||String(asset.currentDriverEmployeeId||'')!==String(employeeId||''))return null;
  const p=asset.driverPrestartId?operations.getPrestart(asset.driverPrestartId):null;
  if(!p||p.status!=='Passed'||!p.isPrimary)return null;
  if(Date.now()-ms(p.completedAt)>24*60*60*1000)return null;
  return p;
}
function locationFrom(b={}){
  const latitude=n(b.latitude),longitude=n(b.longitude);
  return{latitude,longitude,name:clean(b.locationName)||clean(b.location)||((latitude!=null&&longitude!=null)?`${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`:'Location not supplied')};
}
function createEvent(session,b,type){
  const stamp=clean(b.timestamp)||nowIso(),start=clean(b.startTime)||stamp,odo=n(b.odometer);
  if(odo==null||odo<0){const x=new Error('Odometer is required to start the EWD');x.status=400;throw x}
  return{id:'EWDE-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),clientEventId:clean(b.clientEventId)||'',eventType:type,historicData:false,location:locationFrom(b),odometer:Math.round(odo),registration:session.rego,startTime:start,timestamp:stamp,comment:clean(b.comment),origin:'EWD',createdAt:stamp,modifiedAt:null,confirmedAt:null,correctionLog:[]};
}
function summary(session){
  const t=rules.tripTotals(session.events||[],session.startedAt,session.endedAt),gpsKm=rules.gpsDistanceKm(session.gps||[]),events=(session.events||[]).filter(x=>['Work','Rest'].includes(x.eventType));
  const first=events.find(x=>n(x.odometer)!=null),last=[...events].reverse().find(x=>n(x.odometer)!=null);
  const odoKm=first&&last&&Number(last.odometer)>=Number(first.odometer)?Math.round(Number(last.odometer)-Number(first.odometer)):null;
  return{...t,distanceKm:odoKm??gpsKm,gpsDistanceKm:gpsKm,odometerDistanceKm:odoKm,breaks:events.filter(x=>x.eventType==='Rest').length,workChanges:events.filter(x=>x.eventType==='Work').length,alerts:(session.alerts||[]).length,potentialNonCompliance:rules.analyse(session.events||[],session.workRestOption,session.endedAt||nowIso()).potentialNonCompliance.length,gpsPoints:(session.gps||[]).length};
}
function enriched(session){return{...session,fatigue:rules.analyse(session.events||[],session.workRestOption,session.endedAt||nowIso()),summary:summary(session)}}
function syncAlerts(session){
  const a=rules.analyse(session.events||[],session.workRestOption),next=a.nextLimit;
  if(a.activity!=='Work'||!next||['ok','info'].includes(next.severity))return;
  const last=[...(session.events||[])].sort((a,b)=>ms(b.startTime)-ms(a.startTime))[0];
  const key=[next.ruleId,next.severity,last?.id||'none'].join(':');
  ewd.addAlert(session.id,{id:'EWDA-'+Date.now().toString(36).toUpperCase(),dedupeKey:key,timestamp:nowIso(),severity:next.severity,ruleId:next.ruleId,title:next.remainingWorkMin<=0?'Potential non-compliance':'Fatigue break approaching',message:a.message});
}

// Single source of truth for Employee-profile EWD credentials.
router.patch('/api/employees/:id/ewd-pin',(req,res)=>{
  try{
    const employee=employees.find(e=>String(e.id)===String(req.params.id));
    if(!employee)return res.status(404).json({error:'Employee not found'});
    const pin=clean(req.body?.pin);
    if(!/^\d{4,8}$/.test(pin))return res.status(400).json({error:'EWD PIN must be 4 to 8 digits'});
    ewd.setPin(employee.id,pin);
    const verified=ewd.hasPin(employee.id)&&ewd.verifyPin(employee.id,pin);
    if(!verified)return res.status(500).json({error:'EWD PIN failed its save verification. The credential was not accepted.'});
    res.set('Cache-Control','no-store');
    res.json({ok:true,employeeId:employee.id,driverName:employeeName(employee),hasPin:true,selfVerified:true,updatedAt:nowIso()});
  }catch(e){res.status(500).json({error:e.message||'Unable to save EWD PIN'})}
});

// Single source of truth for starting an EWD. This intentionally handles the full
// start transaction so no secondary PIN middleware or route can disagree with it.
router.post('/api/ewd/start',(req,res)=>{
  try{
    const b=req.body||{},employeeId=clean(b.employeeId),assetId=clean(b.assetId);
    const employee=employees.find(e=>String(e.id)===employeeId),asset=assets.find(a=>String(a.id)===assetId);
    if(!employee||!asset)return res.status(404).json({error:'Driver or vehicle not found'});
    const driverName=employeeName(employee);

    if(!ewd.hasPin(employee.id))return res.status(409).json({error:`No EWD PIN is configured for ${driverName}. Set it on this employee record before starting the diary.`,code:'EWD_PIN_NOT_CONFIGURED',employeeId:employee.id,driverName});
    const pin=clean(b.pin);
    if(!/^\d{4,8}$/.test(pin))return res.status(400).json({error:`Enter the EWD PIN configured for ${driverName}.`,code:'EWD_PIN_REQUIRED',employeeId:employee.id,driverName});
    if(!ewd.verifyPin(employee.id,pin))return res.status(401).json({error:`Incorrect EWD PIN for ${driverName}. Reset the PIN on this same Employee record and try again.`,code:'EWD_PIN_MISMATCH',employeeId:employee.id,driverName});

    const prestart=prestartEligible(asset,employeeId);
    if(!prestart)return res.status(409).json({error:`EWD can only start after a current Passed primary pre-start for ${driverName} and ${asset.rego||asset.name||'this vehicle'}.`,code:'PRESTART_REQUIRED'});
    const current=ewd.getActiveSession(employeeId);
    if(current)return res.status(409).json({error:`${driverName} already has an active EWD session.`,code:'EWD_ALREADY_ACTIVE',sessionId:current.id});
    const assetBusy=ewd.listSessions().find(s=>s.status==='ACTIVE'&&String(s.assetId)===assetId);
    if(assetBusy)return res.status(409).json({error:'This vehicle already has an active EWD session'});
    const option=clean(b.workRestOption)||'Standard';
    if(!allowedOptions.includes(option))return res.status(400).json({error:'This candidate build currently enables Standard and BFM reference profiles only.'});

    const stamp=clean(b.timestamp)||nowIso(),id='EWD-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
    const session={id,status:'ACTIVE',approvalStatus:'CANDIDATE_NOT_APPROVED',employeeId:employee.id,driverId:uid(employee),driverName,licenceNumber:employee.licenceNo||'',licenceState:employee.licenceState||'OTH',assetId:asset.id,assetName:asset.name,assetType:asset.type,rego:asset.rego,prestartId:prestart.id,prestartCompletedAt:prestart.completedAt,driverBase:clean(b.driverBase),baseTimeZone:clean(b.baseTimeZone)||'Australia/Brisbane',baseUtcOffset:clean(b.baseUtcOffset)||'+10:00',recordKeeperLocation:clean(b.recordKeeperLocation),workRestOption:option,accreditationNumber:clean(b.accreditationNumber),drivingArrangement:'Solo',startedAt:clean(b.startTime)||stamp,endedAt:null,endReason:'',events:[],gps:[],alerts:[],confirmations:[],annotations:[],twoUpEvents:[],createdAt:stamp,updatedAt:stamp,system:{approvalHolder:'Supervisor365 Candidate',name:'Supervisor365 EWD Candidate',version:'0.1.0',approvalStatus:'NOT_NHVR_APPROVED'}};
    const event=createEvent(session,{...b,startTime:session.startedAt,timestamp:stamp,comment:clean(b.comment)||`EWD started after pre-start ${prestart.id}`},'Work');
    session.events.push(event);ewd.saveSession(session);asset.reading=event.odometer;syncAlerts(session);
    res.status(201).json(enriched(ewd.getSession(id)));
  }catch(e){res.status(e.status||500).json({error:e.message||'Unable to start EWD'})}
});

if(!express.__sv365EwdUnifiedAuth){
  express.__sv365EwdUnifiedAuth=true;
  const previousJson=express.json;
  express.json=function(...args){
    const parser=previousJson(...args);
    return function sv365JsonWithUnifiedEwdAuth(req,res,next){
      parser(req,res,err=>err?next(err):router(req,res,next));
    };
  };
}

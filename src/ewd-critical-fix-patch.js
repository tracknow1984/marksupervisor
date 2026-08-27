const express=require('express');
const {assets,employees}=require('./store');
const operations=require('./persistent-store');
const ewd=require('./ewd-store');
const rules=require('./ewd-rule-engine');
const {latchDriver}=require('./driver-assignment');

const DAY=86400000;
const clean=v=>String(v??'').trim();
const ms=v=>{const n=new Date(v||0).getTime();return Number.isFinite(n)?n:0};
const employeeName=e=>[e?.firstName,e?.lastName].filter(Boolean).join(' ').trim()||e?.email||e?.id||'Driver';

function isPrimaryPrestart(p,all){
  if(p?.isPrimary===true)return true;
  if(p?.isPrimary===false)return false;
  const same=(all||[]).filter(x=>String(x.sessionId||'')===String(p?.sessionId||''));
  return same.length<=1||String(same[0]?.id||'')===String(p?.id||'');
}
function recentPassedPrimary({employeeId='',includeUnassigned=false}={}){
  const all=operations.listPrestarts();
  const cutoff=Date.now()-DAY;
  return all.filter(p=>{
    if(String(p.status||'')!=='Passed'||ms(p.completedAt)<cutoff||!isPrimaryPrestart(p,all))return false;
    if(employeeId&&String(p.employeeId||'')!==String(employeeId))return false;
    if(!includeUnassigned&&!clean(p.employeeId))return false;
    return true;
  }).sort((a,b)=>ms(b.completedAt)-ms(a.completedAt));
}
function prestartEligible(asset,employeeId){
  if(!asset||!employeeId)return null;
  return recentPassedPrimary({employeeId}).find(p=>String(p.assetId)===String(asset.id))||null;
}
function tripSummary(s){
  const t=rules.tripTotals(s.events||[],s.startedAt,s.endedAt),gpsKm=rules.gpsDistanceKm(s.gps||[]),events=(s.events||[]).filter(x=>['Work','Rest'].includes(x.eventType));
  const first=events.find(x=>Number.isFinite(Number(x.odometer))),last=[...events].reverse().find(x=>Number.isFinite(Number(x.odometer)));
  const odo=first&&last&&Number(last.odometer)>=Number(first.odometer)?Math.round(Number(last.odometer)-Number(first.odometer)):null;
  return{...t,distanceKm:odo??gpsKm,gpsDistanceKm:gpsKm,odometerDistanceKm:odo,breaks:events.filter(x=>x.eventType==='Rest').length,workChanges:events.filter(x=>x.eventType==='Work').length,alerts:(s.alerts||[]).length,potentialNonCompliance:rules.analyse(s.events||[],s.workRestOption,s.endedAt||new Date().toISOString()).potentialNonCompliance.length,gpsPoints:(s.gps||[]).length};
}
function enriched(s){return{...s,fatigue:rules.analyse(s.events||[],s.workRestOption,s.endedAt||new Date().toISOString()),summary:tripSummary(s)}}
function eligibleAssignments(employeeId=''){
  const rows=recentPassedPrimary({employeeId});
  const seenAsset=new Set(),seenDriver=new Set(),out=[];
  for(const p of rows){
    const asset=assets.find(a=>String(a.id)===String(p.assetId)),emp=employees.find(e=>String(e.id)===String(p.employeeId));
    if(!asset||!emp)continue;
    const aid=String(asset.id),eid=String(emp.id);
    if(seenAsset.has(aid)||seenDriver.has(eid))continue;
    seenAsset.add(aid);seenDriver.add(eid);
    const currentAt=ms(asset.driverLatchedAt),preAt=ms(p.completedAt);
    if(!asset.currentDriverEmployeeId||String(asset.currentDriverEmployeeId)===eid||preAt>=currentAt){
      try{latchDriver(asset,emp,p)}catch(e){console.warn('EWD assignment restore failed:',e.message)}
    }
    const active=ewd.getActiveSession(emp.id);
    out.push({assetId:asset.id,assetName:asset.name,rego:asset.rego,assetType:asset.type,odometer:Number(asset.reading)||Number(p.reading)||0,employeeId:emp.id,driverName:employeeName(emp),licenceNumber:emp.licenceNo||'',licenceState:emp.licenceState||'',prestartId:p.id,prestartCompletedAt:p.completedAt,prestartLocation:p.address||p.location||'',hasPin:ewd.hasPin(emp.id),activeSessionId:active&&String(active.assetId)===String(asset.id)?active.id:''});
  }
  return out;
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
  if(!active&&!employeeId&&activeSessions.length===1)active=activeSessions[0];
  const historyEmployee=employeeId||active?.employeeId||'';
  const since=Date.now()-28*DAY;
  const history=historyEmployee?ewd.sessionsForDriver(historyEmployee,since).slice(-10).reverse().map(s=>({id:s.id,startedAt:s.startedAt,endedAt:s.endedAt,status:s.status,rego:s.rego,driverName:s.driverName,summary:tripSummary(s)})):[];
  res.set('Cache-Control','no-store');
  res.json({candidate:true,approvalStatus:'NOT_NHVR_APPROVED',eligible,active:active?enriched(active):null,history});
});
preRouter.get('/api/ewd/recovery',(req,res)=>{
  const assignedIds=new Set(recentPassedPrimary().map(p=>String(p.id)));
  const unassigned=recentPassedPrimary({includeUnassigned:true}).filter(p=>!clean(p.employeeId)&&!assignedIds.has(String(p.id))).slice(0,6).map(p=>({prestartId:p.id,completedAt:p.completedAt,assetId:p.assetId,assetName:p.assetName,rego:p.rego,reading:p.reading,location:p.address||p.location||''}));
  res.set('Cache-Control','no-store');
  res.json({unassigned,employees:employees.map(e=>({id:e.id,name:employeeName(e),licenceNumber:e.licenceNo||''}))});
});
preRouter.post('/api/ewd/recovery/link',(req,res)=>{
  try{
    const prestartId=clean(req.body?.prestartId),employeeId=clean(req.body?.employeeId);
    const p=operations.getPrestart(prestartId),emp=employees.find(e=>String(e.id)===String(employeeId));
    if(!p||String(p.status||'')!=='Passed'||Date.now()-ms(p.completedAt)>DAY)return res.status(409).json({error:'A current Passed pre-start is required'});
    if(!emp)return res.status(404).json({error:'Driver / employee not found'});
    const all=operations.listPrestarts();if(!isPrimaryPrestart(p,all))return res.status(409).json({error:'Only the primary vehicle pre-start can start an EWD'});
    if(clean(p.employeeId)&&String(p.employeeId)!==String(emp.id))return res.status(409).json({error:'This pre-start is already assigned to another driver'});
    const updated={...p,employeeId:emp.id,employeeName:employeeName(emp),inspector:employeeName(emp),isPrimary:true};
    operations.savePrestart(updated);
    const asset=assets.find(a=>String(a.id)===String(updated.assetId));
    if(!asset)return res.status(404).json({error:'Vehicle from pre-start was not found'});
    latchDriver(asset,emp,updated);
    res.json({ok:true,employeeId:emp.id,prestartId:updated.id,assetId:asset.id,ewdUrl:'/ewd?employee='+encodeURIComponent(emp.id)});
  }catch(e){res.status(500).json({error:e.message||'Unable to link driver to pre-start'})}
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
      body=body.replace("$('sLocation').value=x.prestartLocation||gps?gps.coords.latitude.toFixed(5)+', '+gps.coords.longitude.toFixed(5):'';","$('sLocation').value=x.prestartLocation||(gps?gps.coords.latitude.toFixed(5)+', '+gps.coords.longitude.toFixed(5):'');");
      body=body.replace("odometer:Number($('sOdo').value),startTime:fromLocal($('sStart').value,$('sOffset').value),timestamp:stamp(Date.now(),$('sOffset').value),...g","odometer:Number($('sOdo').value),startTime:fromLocal($('sStart').value,$('sOffset').value),timestamp:stamp(Date.now(),$('sOffset').value),...g,locationName:$('sLocation').value");
      body=body.replace("locationName:$('cLocation').value,...currentGpsBody(),comment:$('cComment').value","...currentGpsBody(),locationName:$('cLocation').value,comment:$('cComment').value");
      body=body.replace("locationName:$('mLocation').value,...currentGpsBody(),comment:$('mComment').value","...currentGpsBody(),locationName:$('mLocation').value,comment:$('mComment').value");
      body=body.replace("locationName:$('eLocation').value,...currentGpsBody(),timestamp:stamp()","...currentGpsBody(),locationName:$('eLocation').value,timestamp:stamp()");
      body=body.replace("document.querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>prepareStart(rows[Number(b.dataset.assign)]))","document.querySelectorAll('[data-assign]').forEach(b=>b.onclick=async()=>{const x=rows[Number(b.dataset.assign)];if(x.activeSessionId){const br=await fetch('/api/ewd/bootstrap?employeeId='+encodeURIComponent(x.employeeId),{cache:'no-store'}),bd=await br.json();if(br.ok&&bd.active){data=bd;session=bd.active;qs.set('employee',x.employeeId);history.replaceState({},'',location.pathname+'?'+qs);showActive();return}}prepareStart(x)})");
      body=body.replace('You are about to submit your work and rest record for the day. Once submitted, it cannot be corrected. By submitting, you declare that the entries were made by you personally and are not false or misleading. If you are not sure the record is correct, correct it before submission.','You are about to submit your work and rest record for the day. Once you have submitted it, it cannot be corrected.<br><br>By submitting your work and rest record, you are declaring that the entries:<br>• were made by you personally<br>• are not false or misleading<br><br>Confirm that the information in the work and rest record is correct. If you are not sure that the information is correct, correct it now prior to submitting your work and rest record.<br><br>Entries may be used in legal proceedings for an offence against the Heavy Vehicle National Law Act 2012, or another law of a State or the Commonwealth of Australia.<br><br><b>Making a false or misleading entry in an electronic work diary is an offence punishable by a fine of over $10,000.</b>');
      const recovery=`<script id="svEwdRecovery">(()=>{const no=document.getElementById('noGate');if(!no)return;setTimeout(async()=>{try{const b=await fetch('/api/ewd/bootstrap',{cache:'no-store'}),bd=await b.json();if(b.ok&&(bd.eligible?.length||bd.active))return;const r=await fetch('/api/ewd/recovery',{cache:'no-store'}),d=await r.json();if(!r.ok||!d.unassigned?.length)return;const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));no.style.display='block';no.innerHTML='<div class="gateIcon">↗</div><h2>Passed Pre-Start Found</h2><p class="sub">Your inspection passed, but no driver was attached to it. Select the driver once to continue into EWD.</p>'+d.unassigned.map((p,i)=>'<div style="text-align:left;border:1px solid #dce7f1;border-radius:12px;padding:12px;margin:10px 0;background:#f8fbfd"><b>'+esc(p.rego||p.assetName)+'</b><div class="sub" style="margin:4px 0 9px">Passed '+new Date(p.completedAt).toLocaleString('en-AU')+'</div><select class="bigSelect" id="recoverEmp'+i+'"><option value="">Select driver / employee...</option>'+d.employees.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('')+'</select><button class="primary" style="width:100%;margin-top:8px" data-recover="'+esc(p.prestartId)+'" data-index="'+i+'">Link Driver & Open EWD</button></div>').join('');no.querySelectorAll('[data-recover]').forEach(btn=>btn.onclick=async()=>{const emp=document.getElementById('recoverEmp'+btn.dataset.index).value;if(!emp)return alert('Select the driver / employee first.');btn.disabled=true;btn.textContent='Opening EWD...';const rr=await fetch('/api/ewd/recovery/link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prestartId:btn.dataset.recover,employeeId:emp})}),rd=await rr.json();if(!rr.ok){btn.disabled=false;btn.textContent='Link Driver & Open EWD';return alert(rd.error||'Unable to link driver')}location.href=rd.ewdUrl||('/ewd?employee='+encodeURIComponent(emp))})}catch(e){console.warn('EWD recovery check failed',e)}},500)})();</script>`;
      body=body.replace('</body>',recovery+'</body>');
    }
    return originalSend.call(this,body);
  };
}

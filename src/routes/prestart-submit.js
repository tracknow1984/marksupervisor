const express=require('express');
const router=express.Router();
const {assets,employees}=require('../store');
const db=require('../persistent-store');
const {latchDriver,detachDriver}=require('../driver-assignment');
const priorityFor=label=>{const s=String(label||'').toLowerCase();if(/brake|steering|tyre|wheel|seat belt|king pin|tow eye|coupling|breakaway|air system|chassis crack/.test(s))return 'HIGH';if(/light|warning|wiper|mirror|leak|suspension|bearing|exhaust/.test(s))return 'MEDIUM';return 'LOW'};
const brisbaneDate=()=>{const parts=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`};
const validIsoDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
const registrationExpired=asset=>validIsoDate(asset?.registrationExpiry)&&String(asset.registrationExpiry)<brisbaneDate();
const displayDate=v=>{if(!validIsoDate(v))return String(v||'');const [y,m,d]=String(v).split('-');return `${d}/${m}/${y}`};
const FITNESS_DECLARATION_VERSION='2026-08-31';
const FITNESS_DECLARATION={
  heading:'I hereby declare and confirm the following before commencing my shift:',
  items:[
    {title:'Fatigue Management',text:'I have had the required restorative rest break, feel adequately slept, and am not impaired by fatigue.'},
    {title:'Alcohol and Other Drugs',text:'I am completely free from the influence of alcohol, illicit drugs, or any prescription/over-the-counter medications that may impair my driving ability or cognitive judgment.'},
    {title:'Physical & Mental Health',text:'I am not suffering from any temporary illness, injury, medical episode, or extreme psychological/emotional distress that makes me unfit to operate a heavy vehicle safely.'},
    {title:'Compliance & Obligations',text:'I understand my primary duty under the Heavy Vehicle National Law (HVNL) to stop driving or step away immediately if my fitness for duty changes during my shift.'}
  ]
};

router.post('/api/prestarts',(req,res)=>{
  try{
    const {sessionId,inspector,employeeId,records}=req.body||{};
    if(!Array.isArray(records)||!records.length)return res.status(400).json({error:'No inspection records supplied'});
    if(!employeeId)return res.status(400).json({error:'Select the driver / employee completing this pre-start. A driver is required before the Electronic Work Diary can be enabled.'});
    const employee=employees.find(e=>String(e.id)===String(employeeId));
    if(!employee)return res.status(400).json({error:'Selected employee was not found'});
    const employeeName=[employee.firstName,employee.lastName].filter(Boolean).join(' ').trim();

    const resolved=records.map((row,rowIndex)=>({row,rowIndex,asset:assets.find(a=>String(a.id)===String(row.assetId))}));
    const missing=resolved.find(x=>!x.asset);
    if(missing)return res.status(400).json({error:'Selected asset was not found'});
    const expired=resolved.find(x=>registrationExpired(x.asset));
    if(expired){
      const a=expired.asset;
      return res.status(409).json({
        error:`Pre-start blocked: ${a.rego||a.name||a.id} registration expired on ${displayDate(a.registrationExpiry)}. Renew the registration and update the asset record before completing a pre-start.`,
        code:'REGISTRATION_EXPIRED',assetId:a.id,registrationExpiry:a.registrationExpiry
      });
    }

    const created=[];
    for(const {row,rowIndex,asset} of resolved){
      if(row.fitnessForDutyAccepted!==true)return res.status(400).json({error:`Fitness for Duty declaration must be confirmed before signing the pre-start for ${asset.name}`,code:'FITNESS_DECLARATION_REQUIRED',assetId:asset.id});
      if(!row.signature)return res.status(400).json({error:`Signature required for ${asset.name}`});
      const results=Array.isArray(row.results)?row.results:[];
      const failed=results.filter(x=>String(x.value||'').trim().toLowerCase()==='fail');
      const now=new Date().toISOString();
      const acceptedAt=Number.isFinite(Date.parse(String(row.fitnessForDutyAcceptedAt||'')))?new Date(row.fitnessForDutyAcceptedAt).toISOString():now;
      const id='PS-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,7).toUpperCase();
      const isPrimary=row.isPrimary!==undefined?!!row.isPrimary:rowIndex===0;
      const rec={id,sessionId:sessionId||'SESSION-'+Date.now(),assetId:asset.id,assetName:asset.name,assetType:asset.type,rego:asset.rego,employeeId:employee.id,employeeName,inspector:employeeName||inspector||'Current User',isPrimary,completedAt:now,inspectionDate:row.inspectionDate,location:row.location||asset.location||'',address:row.address||'',latitude:Number.isFinite(Number(row.latitude))?Number(row.latitude):null,longitude:Number.isFinite(Number(row.longitude))?Number(row.longitude):null,locationAccuracy:Number.isFinite(Number(row.locationAccuracy))?Number(row.locationAccuracy):null,locationCapturedAt:row.locationCapturedAt||null,reading:Number(row.reading)||0,notes:row.notes||'',results,signature:row.signature,fitnessForDutyDeclaration:{accepted:true,acceptedAt,version:FITNESS_DECLARATION_VERSION,heading:FITNESS_DECLARATION.heading,items:FITNESS_DECLARATION.items},status:failed.length?'Failed':'Passed',failedCount:failed.length};
      const defectRows=failed.map((f,i)=>({id:'DEF-'+Date.now().toString(36).toUpperCase()+'-'+i+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),assetId:asset.id,assetName:asset.name,assetType:asset.type,rego:asset.rego,prestartId:id,prestartItemId:f.itemId??('IDX-'+i),defect:f.label||'Pre-Start defect',reportedAt:now,reportedBy:rec.inspector,reading:rec.reading,location:rec.address||rec.location||'',priority:priorityFor(f.label),status:'OPEN',action:'',resolutionNotes:'',updatedAt:now,resolvedAt:null,closedAt:null}));
      db.savePrestartWithDefects(rec,defectRows);
      const savedPrestart=db.getPrestart(id);
      const savedDefects=db.listDefects().filter(d=>String(d.prestartId)===String(id));
      if(!savedPrestart||savedDefects.length!==defectRows.length)throw new Error(`Persistence verification failed for ${id}: expected ${defectRows.length} defects, found ${savedDefects.length}`);
      if(!savedPrestart.fitnessForDutyDeclaration?.accepted)throw new Error(`Fitness for Duty declaration persistence verification failed for ${id}`);
      asset.reading=rec.reading;
      asset.openDefects=db.listDefects().filter(d=>String(d.assetId)===String(asset.id)&&!['RESOLVED','CLOSED'].includes(String(d.status||'').toUpperCase())).length;
      if(isPrimary)latchDriver(asset,employee,rec);
      created.push({...rec,driverLatched:isPrimary,ewdEligible:isPrimary&&rec.status==='Passed',ewdUrl:isPrimary&&rec.status==='Passed'?'/ewd?employee='+encodeURIComponent(employee.id):'',defectsCreated:savedDefects.length,defectIds:savedDefects.map(d=>d.id)});
    }
    res.set('Cache-Control','no-store');
    res.status(201).json(created);
  }catch(e){console.error('Verified prestart submit failed:',e);res.status(500).json({error:e.message||'Unable to save inspection and defects'})}
});

router.post('/api/driver-assignments/detach',(req,res)=>{
  try{
    const assetId=String(req.body?.assetId||'').trim();
    const employeeId=String(req.body?.employeeId||'').trim();
    if(!assetId)return res.status(400).json({error:'Asset is required'});
    const asset=assets.find(a=>String(a.id)===assetId);
    if(!asset)return res.status(404).json({error:'Asset not found'});
    if(!asset.currentDriverEmployeeId)return res.json({ok:true,detached:false,message:'No driver is currently assigned to this asset'});
    const released=detachDriver(asset,{reason:employeeId?'driver_self_detach':'manual_detach',expectedEmployeeId:employeeId});
    res.set('Cache-Control','no-store');
    res.json({ok:true,detached:true,assignment:released});
  }catch(e){
    if(e.code==='DRIVER_ASSIGNMENT_MISMATCH')return res.status(409).json({error:e.message});
    res.status(500).json({error:e.message||'Unable to detach driver'});
  }
});

module.exports=router;

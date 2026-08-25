const express=require('express');
const router=express.Router();
const {assets,employees}=require('../store');
const db=require('../persistent-store');
const priorityFor=label=>{const s=String(label||'').toLowerCase();if(/brake|steering|tyre|wheel|seat belt|king pin|tow eye|coupling|breakaway|air system|chassis crack/.test(s))return 'HIGH';if(/light|warning|wiper|mirror|leak|suspension|bearing|exhaust/.test(s))return 'MEDIUM';return 'LOW'};

function clearAssetDriver(asset){
  asset.currentDriverEmployeeId='';
  asset.currentDriverName='';
  asset.currentDriverEmail='';
  asset.currentDriverPhone='';
  asset.driverLatchedAt='';
  asset.driverPrestartId='';
}
function clearEmployeeAsset(employee){
  employee.currentAssetId='';
  employee.currentAssetName='';
  employee.currentAssetRego='';
  employee.currentAssetAssignedAt='';
  employee.currentPrestartId='';
}
function latchDriver(asset,employee,prestart){
  const priorEmployeeId=String(asset.currentDriverEmployeeId||'');
  if(priorEmployeeId&&priorEmployeeId!==String(employee.id)){
    const priorEmployee=employees.find(e=>String(e.id)===priorEmployeeId);
    if(priorEmployee&&String(priorEmployee.currentAssetId||'')===String(asset.id))clearEmployeeAsset(priorEmployee);
  }
  for(const other of assets){
    if(String(other.id)!==String(asset.id)&&String(other.currentDriverEmployeeId||'')===String(employee.id))clearAssetDriver(other);
  }
  asset.currentDriverEmployeeId=employee.id;
  asset.currentDriverName=[employee.firstName,employee.lastName].filter(Boolean).join(' ').trim()||employee.email||employee.id;
  asset.currentDriverEmail=employee.email||'';
  asset.currentDriverPhone=employee.phone||'';
  asset.driverLatchedAt=prestart.completedAt;
  asset.driverPrestartId=prestart.id;
  employee.currentAssetId=asset.id;
  employee.currentAssetName=asset.name;
  employee.currentAssetRego=asset.rego;
  employee.currentAssetAssignedAt=prestart.completedAt;
  employee.currentPrestartId=prestart.id;
}

router.post('/api/prestarts',(req,res)=>{
  try{
    const {sessionId,inspector,employeeId,records}=req.body||{};
    if(!Array.isArray(records)||!records.length)return res.status(400).json({error:'No inspection records supplied'});
    const employee=employeeId?employees.find(e=>String(e.id)===String(employeeId)):null;
    if(employeeId&&!employee)return res.status(400).json({error:'Selected employee was not found'});
    const employeeName=employee?[employee.firstName,employee.lastName].filter(Boolean).join(' ').trim():'';
    const created=[];
    for(const [rowIndex,row] of records.entries()){
      const asset=assets.find(a=>String(a.id)===String(row.assetId));
      if(!asset)return res.status(400).json({error:'Selected asset was not found'});
      if(!row.signature)return res.status(400).json({error:`Signature required for ${asset.name}`});
      const results=Array.isArray(row.results)?row.results:[];
      const failed=results.filter(x=>String(x.value||'').trim().toLowerCase()==='fail');
      const now=new Date().toISOString();
      const id='PS-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,7).toUpperCase();
      const isPrimary=row.isPrimary!==undefined?!!row.isPrimary:rowIndex===0;
      const rec={id,sessionId:sessionId||'SESSION-'+Date.now(),assetId:asset.id,assetName:asset.name,assetType:asset.type,rego:asset.rego,employeeId:employee?.id||'',employeeName:employeeName||inspector||'Current User',inspector:employeeName||inspector||'Current User',isPrimary,completedAt:now,inspectionDate:row.inspectionDate,location:row.location||asset.location||'',address:row.address||'',latitude:Number.isFinite(Number(row.latitude))?Number(row.latitude):null,longitude:Number.isFinite(Number(row.longitude))?Number(row.longitude):null,locationAccuracy:Number.isFinite(Number(row.locationAccuracy))?Number(row.locationAccuracy):null,locationCapturedAt:row.locationCapturedAt||null,reading:Number(row.reading)||0,notes:row.notes||'',results,signature:row.signature,status:failed.length?'Failed':'Passed',failedCount:failed.length};
      const defectRows=failed.map((f,i)=>({id:'DEF-'+Date.now().toString(36).toUpperCase()+'-'+i+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),assetId:asset.id,assetName:asset.name,assetType:asset.type,rego:asset.rego,prestartId:id,prestartItemId:f.itemId??('IDX-'+i),defect:f.label||'Pre-Start defect',reportedAt:now,reportedBy:rec.inspector,reading:rec.reading,location:rec.address||rec.location||'',priority:priorityFor(f.label),status:'OPEN',action:'',resolutionNotes:'',updatedAt:now,resolvedAt:null,closedAt:null}));
      db.savePrestartWithDefects(rec,defectRows);
      const savedPrestart=db.getPrestart(id);
      const savedDefects=db.listDefects().filter(d=>String(d.prestartId)===String(id));
      if(!savedPrestart||savedDefects.length!==defectRows.length){throw new Error(`Persistence verification failed for ${id}: expected ${defectRows.length} defects, found ${savedDefects.length}`)}
      asset.reading=rec.reading;
      asset.openDefects=db.listDefects().filter(d=>String(d.assetId)===String(asset.id)&&!['RESOLVED','CLOSED'].includes(String(d.status||'').toUpperCase())).length;
      if(employee&&isPrimary)latchDriver(asset,employee,rec);
      created.push({...rec,driverLatched:!!(employee&&isPrimary),defectsCreated:savedDefects.length,defectIds:savedDefects.map(d=>d.id)});
    }
    res.set('Cache-Control','no-store');
    res.status(201).json(created);
  }catch(e){console.error('Verified prestart submit failed:',e);res.status(500).json({error:e.message||'Unable to save inspection and defects'})}
});
module.exports=router;

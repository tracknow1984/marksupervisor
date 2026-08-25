const express=require('express');
const router=express.Router();
const {assets}=require('../store');
const db=require('../persistent-store');
const priorityFor=label=>{const s=String(label||'').toLowerCase();if(/brake|steering|tyre|wheel|seat belt|king pin|tow eye|coupling|breakaway|air system|chassis crack/.test(s))return 'HIGH';if(/light|warning|wiper|mirror|leak|suspension|bearing|exhaust/.test(s))return 'MEDIUM';return 'LOW'};
router.post('/api/prestarts',(req,res)=>{
  try{
    const {sessionId,inspector,records}=req.body||{};
    if(!Array.isArray(records)||!records.length)return res.status(400).json({error:'No inspection records supplied'});
    const created=[];
    for(const row of records){
      const asset=assets.find(a=>String(a.id)===String(row.assetId));
      if(!asset)return res.status(400).json({error:'Selected asset was not found'});
      if(!row.signature)return res.status(400).json({error:`Signature required for ${asset.name}`});
      const results=Array.isArray(row.results)?row.results:[];
      const failed=results.filter(x=>String(x.value||'').trim().toLowerCase()==='fail');
      const now=new Date().toISOString();
      const id='PS-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,7).toUpperCase();
      const rec={id,sessionId:sessionId||'SESSION-'+Date.now(),assetId:asset.id,assetName:asset.name,assetType:asset.type,rego:asset.rego,inspector:inspector||'Current User',completedAt:now,inspectionDate:row.inspectionDate,location:row.location||asset.location||'',address:row.address||'',latitude:Number.isFinite(Number(row.latitude))?Number(row.latitude):null,longitude:Number.isFinite(Number(row.longitude))?Number(row.longitude):null,locationAccuracy:Number.isFinite(Number(row.locationAccuracy))?Number(row.locationAccuracy):null,locationCapturedAt:row.locationCapturedAt||null,reading:Number(row.reading)||0,notes:row.notes||'',results,signature:row.signature,status:failed.length?'Failed':'Passed',failedCount:failed.length};
      const defectRows=failed.map((f,i)=>({id:'DEF-'+Date.now().toString(36).toUpperCase()+'-'+i+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),assetId:asset.id,assetName:asset.name,assetType:asset.type,rego:asset.rego,prestartId:id,prestartItemId:f.itemId??('IDX-'+i),defect:f.label||'Pre-Start defect',reportedAt:now,reportedBy:rec.inspector,reading:rec.reading,location:rec.address||rec.location||'',priority:priorityFor(f.label),status:'OPEN',action:'',resolutionNotes:'',updatedAt:now,resolvedAt:null,closedAt:null}));
      db.savePrestartWithDefects(rec,defectRows);
      const savedPrestart=db.getPrestart(id);
      const savedDefects=db.listDefects().filter(d=>String(d.prestartId)===String(id));
      if(!savedPrestart||savedDefects.length!==defectRows.length){throw new Error(`Persistence verification failed for ${id}: expected ${defectRows.length} defects, found ${savedDefects.length}`)}
      asset.reading=rec.reading;
      asset.openDefects=db.listDefects().filter(d=>String(d.assetId)===String(asset.id)&&!['RESOLVED','CLOSED'].includes(String(d.status||'').toUpperCase())).length;
      created.push({...rec,defectsCreated:savedDefects.length,defectIds:savedDefects.map(d=>d.id)});
    }
    res.set('Cache-Control','no-store');
    res.status(201).json(created);
  }catch(e){console.error('Verified prestart submit failed:',e);res.status(500).json({error:e.message||'Unable to save inspection and defects'})}
});
module.exports=router;

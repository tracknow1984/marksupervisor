const crypto=require('crypto');
const {assets}=require('./store');
const services=require('./service-store');

const key=value=>String(value??'').trim().toUpperCase().replace(/\s+/g,'');
function preview(rows){
 if(!Array.isArray(rows)||rows.length>1000)throw new Error('Provide up to 1,000 service rows');
 const seen=new Set();
 return rows.map((row,index)=>{
  const fleetId=String(row.fleetId??row['FLEET ID']??'').trim();
  const date=String(row.date??row['LAST SERVICES']??'').trim();
  const raw=row.reading??row['CURRENT HRS/KMS'];
  const reading=Number(raw);
  const matches=assets.filter(a=>key(a.plantId)===key(fleetId)&&key(fleetId));
  const validDate=/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
  let status=!fleetId||!validDate||raw==null||raw===''||!Number.isFinite(reading)||reading<0?'Invalid data':matches.length===0?'Asset not found':matches.length>1?'Ambiguous Plant ID':'Ready';
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify([key(fleetId),date,reading])).digest('hex').slice(0,24);
  const id='HIST-'+fingerprint;
  if(status==='Ready'&&(seen.has(id)||services.get(id)))status='Already imported';
  seen.add(id);
  return{row:index+1,fleetId,date,reading:Number.isFinite(reading)?reading:null,assetId:matches.length===1?matches[0].id:null,assetName:matches.length===1?matches[0].name:null,status,id};
 });
}
function commit(rows){
 const result=preview(rows);
 if(result.some(x=>!['Ready','Already imported'].includes(x.status)))throw new Error('Resolve unmatched or invalid rows before importing');
 const now=new Date().toISOString();
 for(const x of result.filter(x=>x.status==='Ready'))services.save({id:x.id,assetId:x.assetId,rego:assets.find(a=>a.id===x.assetId)?.rego||'',assetName:x.assetName,serviceType:'Service (type not recorded)',requestedDate:x.date,completedDate:x.date,completedReading:x.reading,serviceCentre:'',completionNotes:'Historical baseline imported from fleet service register; service type and work details not supplied.',status:'COMPLETED',source:'historical-import',sourceFleetId:x.fleetId,createdAt:now,updatedAt:now});
 return{imported:result.filter(x=>x.status==='Ready').length,alreadyImported:result.filter(x=>x.status==='Already imported').length};
}
module.exports={preview,commit};

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {assetIdentity}=require('./rego-check');
function createBulk({assets,check,file,delayMs=10000,schedule=setTimeout,cancel=clearTimeout}){
 let job=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null,timer=null,inFlight=false;
 const save=()=>{fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(job),{mode:0o600});fs.renameSync(tmp,file)};
 // An interrupted lookup has an unknown outcome. Keep the queue but require an explicit resume.
 if(job&&['running','pausing'].includes(job.state)){job.state='paused';job.message='Server restarted. Resume to continue the saved queue.';for(const item of job.items)if(item.state==='checking'){const a=assets.find(a=>a.id===item.assetId);if(a?.registrationCheck?.state==='verified'&&Date.parse(a.registrationCheckedAt)>=Date.parse(item.startedAt)){item.state='updated';item.message='Saved before restart'}else item.state='pending'}save()}
 function preview(includeUnknown=false){
  const seen=new Set();return assets.map(a=>{const id=assetIdentity(a);let reason='';if(!/^[A-Z0-9]{1,10}$/.test(id.rego))reason='Missing or invalid registration';else if(id.state&&id.state!=='QLD')reason='Not Queensland';else if(!id.state&&!includeUnknown)reason='Registration state not recorded';else if(seen.has(id.rego))reason='Duplicate registration';if(!reason)seen.add(id.rego);return{assetId:a.id,name:a.name||a.plantId||'',rego:id.rego,registrationState:id.state,state:reason?'skipped':'pending',message:reason}})
 }
 function status(){if(!job)return null;const counts={pending:0,checking:0,updated:0,skipped:0,failed:0};for(const i of job.items)counts[i.state]=(counts[i.state]||0)+1;return{...job,counts,total:job.items.length,processed:counts.updated+counts.skipped+counts.failed}}
 function later(ms=delayMs){if(timer)cancel(timer);timer=schedule(()=>{timer=null;void tick()},ms);timer?.unref?.()}
 async function tick(){
  if(!job||job.state!=='running'||inFlight)return;
  const item=job.items.find(i=>i.state==='pending');
  if(!item){job.state='completed';job.finishedAt=new Date().toISOString();job.message='Fleet check complete.';save();return}
  const asset=assets.find(a=>a.id===item.assetId),identity=asset&&assetIdentity(asset);
  if(!asset||identity.rego!==item.rego||identity.state!==item.registrationState){item.state='skipped';item.message='Asset registration changed or asset removed';save();later(0);return}
  item.state='checking';item.startedAt=new Date().toISOString();job.message='Checking '+item.rego;save();inFlight=true;
  try{
   const result=await check(item.assetId,job.by);
   if(result.ok){item.state='updated';item.message=result.check.result.status+' · '+result.check.result.expiry}
   else if(result.check.state==='busy'){item.state='pending';item.message=result.check.message;job.message='Waiting for another registration check or cooldown.'}
   else if(['blocked','rate_limited','upstream','unavailable','interrupted'].includes(result.check.state)){
    item.state='pending';item.message=result.check.message;job.state='paused';job.message='Paused: '+result.check.message;
   }else{item.state='failed';item.message=result.check.message||'Could not verify registration'}
  }catch(e){
   item.state='pending';item.message=e.message;
   if(e.code==='busy'){job.message='Waiting for another registration check or cooldown.'}
   else{job.state='paused';job.message='Paused: '+e.message}
  }finally{
   inFlight=false;
   if(job.state==='pausing'){job.state='paused';job.message='Paused. The in-progress check has finished.'}
   job.updatedAt=new Date().toISOString();save();if(job.state==='running')later();
  }
 }
 return{
  preview,status,
  start({includeUnknown=false,by}){
   if(inFlight||job&&['running','paused','pausing'].includes(job.state))throw Error('Finish or cancel the existing fleet check first.');
   const items=preview(includeUnknown);if(!items.some(i=>i.state==='pending'))throw Error('No eligible Queensland registrations to check.');
   job={id:crypto.randomUUID(),state:'running',by,includeUnknown,createdAt:new Date().toISOString(),message:'Fleet check queued.',items};save();later(0);return status();
  },
  pause(){if(!job||job.state!=='running')throw Error('No fleet check is running.');if(timer)cancel(timer);timer=null;job.state=inFlight?'pausing':'paused';job.message=inFlight?'Pausing after the current check.':'Paused.';save();return status()},
  resume(){if(!job||job.state!=='paused'||inFlight)throw Error('This fleet check cannot be resumed yet.');job.state='running';job.message='Resuming saved queue.';save();later();return status()},
  stop(){if(inFlight)throw Error('Pause and wait for the current check before cancelling.');if(timer)cancel(timer);timer=null;if(job){job.state='cancelled';job.message='Cancelled. Completed updates were kept.';save()}return status()},
  isActive(){return inFlight||!!job&&['running','pausing'].includes(job.state)},
  close(){if(timer)cancel(timer);timer=null;if(job&&['running','pausing'].includes(job.state)){job.state='paused';job.message='Server stopped. Resume to continue.';save()}}
 };
}
module.exports={createBulk};

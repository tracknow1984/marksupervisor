const db=require('./persistent-store');
const {assets}=require('./store');
const active=d=>!['RESOLVED','CLOSED'].includes(String(d.status||'').toUpperCase());
function recalc(assetId){const asset=assets.find(a=>String(a.id)===String(assetId));if(asset)asset.openDefects=db.listDefects().filter(d=>String(d.assetId)===String(assetId)&&active(d)).length}
function find(id){return db.listDefects().find(d=>String(d.id)===String(id))}
function validate(id,assetId){if(!id)return null;const d=find(id);if(!d||String(d.assetId)!==String(assetId))throw Error('Defect reference must belong to the selected vehicle');if(!active(d))throw Error('This defect has already been cleared');if(d.linkedServiceId){const service=require('./service-store').get(d.linkedServiceId);if(service?.status==='SCHEDULED')throw Error('A service is already scheduled for this defect');}return d}
function attach(service,defect){if(!defect)return;db.updateDefect(defect.id,{linkedServiceId:service.id,status:'IN PROGRESS',action:'SCHEDULE SERVICE',updatedAt:new Date().toISOString()});recalc(defect.assetId)}
function sync(service){if(!service.defectId)return;const d=find(service.defectId);if(!d||String(d.assetId)!==String(service.assetId)||d.linkedServiceId!==service.id)return;const now=new Date().toISOString();if(service.status==='COMPLETED'){db.updateDefect(d.id,{status:'RESOLVED',action:'REPAIRED',resolvedAt:d.resolvedAt||now,updatedAt:now,completedServiceId:service.id});recalc(d.assetId)}else if(service.status==='CANCELLED'&&active(d)){db.updateDefect(d.id,{status:'OPEN',action:'',linkedServiceId:null,updatedAt:now});recalc(d.assetId)}}
module.exports={find,validate,attach,sync};

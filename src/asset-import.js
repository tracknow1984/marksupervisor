const crypto=require('crypto');
const clean=v=>String(v??'').trim();
const typeMap={'Trucks':'Rigid Truck','HV Trailers':'Semi Trailer','LV Trailers':'Trailer','Excavator':'Excavator','Grader':'Grader','Skid Steer':'Skid Steer','Pozitrack':'Positrack','Rollers':'Roller','Compactor':'Compactor','Forklift':'Forklift','Generator':'Generator','Loader':'Loader','Crusher':'Crusher','Impact Crusher':'Impact Crusher','Powerscreens':'Screen','Stacker':'Stacker'};
function prepare(rows,existing){
 if(!Array.isArray(rows)||!rows.length||rows.length>1000)throw new Error('Provide between 1 and 1000 asset rows');
 const seen=new Set(),keys=new Set(),added=[],skipped=[];
 for(const [i,r] of rows.entries()){
  if(!r||typeof r!=='object'||Array.isArray(r))throw new Error('Invalid row '+(i+1));
  const source={plantId:clean(r.plantId),description:clean(r.description),sourceType:clean(r.sourceType),rego:clean(r.rego),serial:clean(r.serial),year:clean(r.year)};
  if(!source.description)throw new Error('Description is required in row '+(i+1));
  if(Object.values(source).some(v=>v.length>2000||/[<>]/.test(v)))throw new Error('Unsupported content in row '+(i+1));
  if(source.year&&!/^\d{4}$/.test(source.year))throw new Error('Invalid year in row '+(i+1));
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
  const plantId=source.plantId==='-'?'':source.plantId,rego=source.rego.toUpperCase();
  const identity=[...(rego?['rego:'+rego.replace(/\s/g,'')]:[]),...(plantId?['plant:'+plantId.toUpperCase().replace(/\s/g,'')]:[])];
  const match=existing.find(a=>a.importFingerprint===fingerprint||(rego&&clean(a.rego).toUpperCase().replace(/\s/g,'')===rego.replace(/\s/g,''))||(plantId&&clean(a.plantId).toUpperCase().replace(/\s/g,'')===plantId.toUpperCase().replace(/\s/g,'')));
  if(match||seen.has(fingerprint)||identity.some(k=>keys.has(k))){skipped.push({row:i+1,description:source.description,reason:'Existing or duplicate asset'});continue}
  seen.add(fingerprint);identity.forEach(k=>keys.add(k));
  let type=typeMap[source.sourceType]||(/hilux|ranger|landrover|getz/i.test(source.description)?'Light Vehicle':'Other');
  if(/prime mover/i.test(source.description))type='Prime Mover';else if(/dolly/i.test(source.description))type='Dolly';
  const known=['International','Mitsubishi','Kenworth','Caterpillar','New Holland','McCloskey','Toyota','Kobelco','Komatsu','Hitachi','Kubota','Doosan','Hyundai','Sitrack','Sheppard','Luigong','Liugong','Isuzu','Volvo','Hino','Ford','LandRover','XCMG','Sany','JAC','Drake','Fintec','Cat'];
  const make=known.find(m=>source.description.toLowerCase().startsWith(m.toLowerCase()+' ')||source.description.toLowerCase()===m.toLowerCase())||'';
  const model=make?source.description.slice(make.length).trim():'';
  const notes=['Imported from fleet spreadsheet.','Original description: '+source.description,'Original type / assigned person: '+source.sourceType,...(source.year?['Year: '+source.year]:[]),...(source.serial?['Serial/VIN (source): '+source.serial]:[]),'Operating status, odometer/hours and compliance dates were not provided.'];
  const vinMatch=source.serial.match(/(?:VIN|PIN)\s*:\s*([A-Z0-9-]+)/i);
  const vin=vinMatch?vinMatch[1]:(/^[A-Z0-9]{17}$/i.test(source.serial)?source.serial:'');
  added.push({id:'AST-'+crypto.randomUUID(),name:source.description,type,rego,plantId,make,model,vin,year:source.year,serialNumber:source.serial,reading:null,status:'Not recorded',registrationState:'',registrationExpiry:'',insuranceExpiry:'',coiDueDate:'',category:type,additionalNotes:notes.join('\n'),images:[],openDefects:0,serviceDue:false,importFingerprint:fingerprint,importSource:source,importedAt:new Date().toISOString()});
 }
 return{added,skipped};
}
module.exports={prepare};

const fs=require('fs');
const path=require('path');
const dir=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const file=path.join(dir,'service-parts.json');
function read(){if(!process.env.SV365_TENANT_ID)throw new Error('Parts storage requires a company worker');fs.mkdirSync(dir,{recursive:true});if(!fs.existsSync(file))return {catalog:[],lists:[]};try{const data=JSON.parse(fs.readFileSync(file,'utf8'));return {catalog:Array.isArray(data.catalog)?data.catalog:[],lists:Array.isArray(data.lists)?data.lists:[]}}catch(e){console.error('Parts store read failed:',e);return {catalog:[],lists:[]}}}
function write(data){if(!process.env.SV365_TENANT_ID)throw new Error('Parts storage requires a company worker');fs.mkdirSync(dir,{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,file)}
function id(){return 'P-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function price(v){const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error('Price must be zero or greater');return Math.round(n*100)/100}
function quantity(v){const n=Number(v);if(!Number.isFinite(n)||n<=0)throw new Error('Quantity must be greater than zero');return Math.round(n*100)/100}
function partFields(input){
 const name=String(input.name||'').trim();if(!name)throw new Error('Part description is required');
 const kind=String(input.partKind||'');if(!['genuine','non-genuine'].includes(kind))throw new Error('Choose genuine or non-genuine');
 return {name:name.slice(0,120),sku:String(input.sku||'').trim().slice(0,80),partKind:kind,genuine:kind==='genuine',nonGenuine:kind==='non-genuine',category:input.category==='Consumable'?'Consumable':'Part',unit:String(input.unit||'each').trim().slice(0,30)||'each',price:price(input.price),supplier:String(input.supplier||'').trim().slice(0,120)};
}
function addPart(input){const data=read(),part={id:id(),...partFields(input)};data.catalog.push(part);write(data);return part}
function updatePart(partId,input){const data=read(),part=data.catalog.find(p=>p.id===partId);if(!part)throw new Error('Part not found');Object.assign(part,partFields(input));write(data);return part}
function saveList(assetId,serviceType,lines){const data=read();const key=String(assetId),type=String(serviceType);const items=lines.map(line=>{const part=data.catalog.find(p=>p.id===line.partId);if(!part)throw new Error('A selected part no longer exists');return {partId:part.id,quantity:quantity(line.quantity)}});if(!items.length)throw new Error('Add at least one part');const index=data.lists.findIndex(x=>x.assetId===key&&x.serviceType===type);const record={assetId:key,serviceType:type,items,updatedAt:new Date().toISOString()};if(index<0)data.lists.push(record);else data.lists[index]=record;write(data);return record}
function snapshot(assetId,serviceType){const data=read(),list=data.lists.find(x=>x.assetId===String(assetId)&&x.serviceType===String(serviceType));return list?list.items.map(x=>{const p=data.catalog.find(p=>p.id===x.partId);return p?{id:id(),partId:p.id,name:p.name,sku:p.sku,category:p.category,unit:p.unit,unitPrice:p.price,partKind:p.partKind||null,genuine:p.genuine??null,nonGenuine:p.nonGenuine??null,supplier:p.supplier,quantity:x.quantity,status:'pending approval'}:null}).filter(Boolean):[]}
function listRevision(assetId,serviceType,data=read()){const list=data.lists.find(x=>x.assetId===String(assetId)&&x.serviceType===String(serviceType))||null;return require('crypto').createHash('sha256').update(JSON.stringify(list)).digest('hex')}
function prepareImport(rows){return rows.map((row,index)=>{try{return {...partFields(row),quantity:quantity(row.quantity)}}catch(e){throw Error('Row '+(index+2)+': '+e.message)}})}
function importList(assetId,serviceType,rows,revision){
 const prepared=prepareImport(rows);if(!prepared.length)throw Error('Add at least one part.');const data=read();
 if(revision!==listRevision(assetId,serviceType,data))throw Error('This machine parts list changed. Preview the upload again before saving.');
 const items=[];
 for(const {quantity:qty,...fields} of prepared){let part=data.catalog.find(p=>Object.keys(fields).every(k=>p[k]===fields[k]));if(!part){part={id:id(),...fields};data.catalog.push(part);}const existing=items.find(x=>x.partId===part.id);if(existing)existing.quantity=Math.round((existing.quantity+qty)*100)/100;else items.push({partId:part.id,quantity:qty});}
 const record={assetId:String(assetId),serviceType:String(serviceType),items,updatedAt:new Date().toISOString()},index=data.lists.findIndex(x=>x.assetId===record.assetId&&x.serviceType===record.serviceType);
 if(index<0)data.lists.push(record);else data.lists[index]=record;write(data);return record;
}
function mergeMachineReferences(rows){const data=read();let added=0;for(const row of rows){const variants=[];if(row.genuinePartNo)variants.push(['genuine',row.genuinePartNo]);if(row.aftermarketPartNo)variants.push(['non-genuine',row.aftermarketPartNo]);if(row.aftermarketValue&&!/^(yes|no)$/i.test(row.aftermarketValue)&&row.aftermarketValue!==row.aftermarketPartNo)variants.push(['non-genuine',row.aftermarketValue]);if(!variants.length)variants.push(['unspecified','']);for(const [kind,sku] of variants){const key='REF-'+require('crypto').createHash('sha256').update(row.id+'|'+kind+'|'+sku).digest('hex').slice(0,24);if(data.catalog.some(p=>p.id===key))continue;data.catalog.push({id:key,name:row.description,sku,partKind:kind==='unspecified'?null:kind,genuine:kind==='unspecified'?null:kind==='genuine',nonGenuine:kind==='unspecified'?null:kind==='non-genuine',price:null,unit:'each',supplier:'',category:'Part',machineMake:row.make,machineModel:row.model,machineReferenceId:row.id,assetIds:row.assetIds});added++;}}write(data);return added;}
module.exports={read,addPart,updatePart,saveList,snapshot,listRevision,prepareImport,importList,mergeMachineReferences};

const crypto=require('crypto');
const {collection}=require('./tenant-collections');
const records=collection('fuelRecords');
const {assets}=require('./store');
const repo=require('./asset-repository');
const clean=(v,n=160)=>String(v??'').trim().slice(0,n);
function asset(id){const a=assets.find(a=>a.id===id);if(!a)throw new Error('Asset not found in this company');return a}
function saveTag(id,value){const a=asset(id);a.fuelTag=clean(value,80);return a.fuelTag}
function save(b,actor){
 const a=asset(b.assetId);
 const key=clean(b.requestId,80);if(!/^[0-9a-f-]{36}$/i.test(key))throw new Error('Invalid submission reference');
 const existing=records.find(r=>r.requestId===key);if(existing){if(existing.assetId!==a.id)throw new Error('Submission reference already used');return existing}
 const litres=Number(b.litres);if(!Number.isFinite(litres)||litres<=0||litres>10000)throw new Error('Enter litres greater than zero and no more than 10,000');
 if(b.latitude===null||b.longitude===null||b.latitude===''||b.longitude===''||b.latitude===undefined||b.longitude===undefined)throw new Error('Capture the refuelling location first');
 const lat=Number(b.latitude),lon=Number(b.longitude),accuracy=Number(b.accuracy);
 if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180||!Number.isFinite(accuracy)||accuracy<0)throw new Error('Invalid location');
 const captured=Date.parse(b.locationCapturedAt);if(!Number.isFinite(captured)||Math.abs(Date.now()-captured)>15*60*1000)throw new Error('Location is out of date. Capture it again');
 const docket=b.docket;if(!docket||!/^.+\.(pdf|png|jpe?g|webp)$/i.test(clean(docket.filename,180)))throw new Error('Attach a PDF or image fuel docket');
 if(typeof docket.base64!=='string'||docket.base64.length>14*1024*1024||! /^[A-Za-z0-9+/]*={0,2}$/.test(docket.base64))throw new Error('Invalid fuel docket');
 const buffer=Buffer.from(docket.base64,'base64');
 if(!buffer.length||buffer.length>10*1024*1024)throw new Error('Fuel docket must be between 1 byte and 10 MB');
 const filename=clean(docket.filename,180);
 const valid=/\.pdf$/i.test(filename)?buffer.subarray(0,5).toString()==='%PDF-':/\.png$/i.test(filename)?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):/\.jpe?g$/i.test(filename)?buffer[0]===255&&buffer[1]===216&&buffer[2]===255:buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP';
 if(!valid)throw new Error('Docket content does not match its file type');
 const row={id:crypto.randomUUID(),requestId:key,assetId:a.id,assetName:a.name,plantId:a.plantId||'',rego:a.rego||'',fuelTag:a.fuelTag||'',litres,latitude:lat,longitude:lon,accuracy,locationCapturedAt:new Date(captured).toISOString(),createdAt:new Date().toISOString(),submittedBy:clean(actor),notes:clean(b.notes,2000)};
 const doc=repo.create(a.id,'file',{title:'Fuel docket · '+row.createdAt.slice(0,10)+' · '+litres+' L',filename,public:false},buffer);row.docketId=doc.id;row.docketFilename=doc.filename;
 try{records.push(row)}catch(e){repo.update(a.id,doc.id,{archived:true});throw e}return row;
}
module.exports={asset,saveTag,save,list:()=>[...records].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};

const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {collection}=require('./tenant-collections');
const records=collection('assetRepository');
const dir=path.join(process.env.SV365_DATA_DIR,'asset-documents');
const clean=(v,max=120)=>String(v||'').trim().slice(0,max);
function list(assetId,archived=false){return records.filter(x=>x.assetId===assetId&&(archived||!x.archivedAt))}
function get(assetId,id){return records.find(x=>x.assetId===assetId&&x.id===id)}
function folder(assetId,id){if(!id)return '';const row=get(assetId,id);if(!row||row.kind!=='folder'||row.archivedAt)throw new Error('Select an active folder for this asset');return row.id}
function create(assetId,kind,b,buffer){
 if(list(assetId,true).length>=1000)throw new Error('This asset repository has reached its item limit');
 const title=clean(b.title);if(!title)throw new Error('Enter a name');
 const row={id:crypto.randomUUID(),assetId,kind,title,folderId:kind==='folder'?'':folder(assetId,b.folderId),public:kind!=='folder'&&b.public===true,createdAt:new Date().toISOString()};
 if(kind==='note'){row.text=clean(b.text,10000);if(!row.text)throw new Error('Enter the note information')}
 if(kind==='file'){
  if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>10*1024*1024)throw new Error('Choose a file up to 10 MB');
  row.filename=clean(b.filename,180).replace(/[\r\n\x00-\x1f/\\]/g,'_')||'document';row.size=buffer.length;
  fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.writeFileSync(path.join(dir,row.id+'.bin'),buffer,{mode:0o600,flag:'wx'});
 }
 try{records.push(row)}catch(e){if(kind==='file')fs.unlinkSync(path.join(dir,row.id+'.bin'));throw e}return row;
}
function update(assetId,id,b){
 const row=get(assetId,id);if(!row)throw new Error('Item not found');
 const title=b.title===undefined?row.title:clean(b.title);if(!title)throw new Error('Enter a name');
 const folderId=row.kind==='folder'?'':folder(assetId,b.folderId===undefined?row.folderId:b.folderId);
 if(b.archived===true&&row.kind==='folder'&&list(assetId).some(x=>x.folderId===id))throw new Error('Move or archive the folder contents first');
 const text=row.kind==='note'&&b.text!==undefined?clean(b.text,10000):row.text;if(row.kind==='note'&&!text)throw new Error('Enter the note information');
 Object.assign(row,{title,folderId,updatedAt:new Date().toISOString()});if(row.kind==='note')row.text=text;
 if(typeof b.public==='boolean'&&row.kind!=='folder')row.public=b.public;
 if(typeof b.archived==='boolean')row.archivedAt=b.archived?new Date().toISOString():null;
 return row;
}
function filePath(row){if(!/^[0-9a-f-]{36}$/.test(row.id))throw new Error('Invalid file');return path.join(dir,row.id+'.bin')}
function download(res,row){res.set('X-Content-Type-Options','nosniff');res.type('application/octet-stream');res.set('Content-Disposition',`attachment; filename="${row.filename.replace(/[^a-zA-Z0-9._-]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`);res.sendFile(filePath(row));}
module.exports={list,get,create,update,download};

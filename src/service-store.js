const fs=require('fs');
const path=require('path');
const DATA_DIR=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const FILE=path.join(DATA_DIR,'services.json');
function ensure(){fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(FILE))fs.writeFileSync(FILE,'[]')}
function list(){ensure();try{const d=JSON.parse(fs.readFileSync(FILE,'utf8'));return Array.isArray(d)?d:[]}catch(e){console.error('Service store read failed:',e.message);return[]}}
function write(rows){ensure();const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(rows,null,2));fs.renameSync(tmp,FILE)}
function save(record){const rows=list();const i=rows.findIndex(x=>String(x.id)===String(record.id));if(i>=0)rows[i]=record;else rows.push(record);write(rows);return record}
function get(id){return list().find(x=>String(x.id)===String(id))}
function update(id,changes){const rows=list();const r=rows.find(x=>String(x.id)===String(id));if(!r)return null;Object.assign(r,changes,{updatedAt:new Date().toISOString()});write(rows);return r}
module.exports={FILE,list,save,get,update};

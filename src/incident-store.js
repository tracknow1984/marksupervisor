const fs=require('fs');
const path=require('path');
const DATA_DIR=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const FILE=path.join(DATA_DIR,'incidents.json');
function ensure(){fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(FILE))fs.writeFileSync(FILE,'[]')}
function list(){ensure();try{const data=JSON.parse(fs.readFileSync(FILE,'utf8'));return Array.isArray(data)?data:[]}catch(e){console.error('Incident store read failed:',e.message);return[]}}
function write(rows){ensure();const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(rows,null,2));fs.renameSync(tmp,FILE)}
function save(record){const rows=list();const i=rows.findIndex(x=>String(x.id)===String(record.id));if(i>=0)rows[i]=record;else rows.push(record);write(rows);return record}
function get(id){return list().find(x=>String(x.id)===String(id))}
function remove(id){const rows=list();const next=rows.filter(x=>String(x.id)!==String(id));if(next.length===rows.length)return false;write(next);return true}
module.exports={FILE,list,save,get,remove};

const fs=require('fs');
const path=require('path');
const DATA_DIR=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const FILE=path.join(DATA_DIR,'gps-shares.json');
function ensure(){fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(FILE))fs.writeFileSync(FILE,'[]')}
function list(){ensure();try{const rows=JSON.parse(fs.readFileSync(FILE,'utf8'));return Array.isArray(rows)?rows:[]}catch(e){console.error('GPS share store read failed:',e.message);return[]}}
function write(rows){ensure();const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(rows,null,2));fs.renameSync(tmp,FILE)}
function save(record){const rows=list();const i=rows.findIndex(x=>String(x.id)===String(record.id));if(i>=0)rows[i]=record;else rows.push(record);write(rows);return record}
function getByToken(token){return list().find(x=>String(x.token)===String(token))||null}
function revoke(id){const rows=list();const row=rows.find(x=>String(x.id)===String(id));if(!row)return null;row.revokedAt=new Date().toISOString();row.updatedAt=row.revokedAt;write(rows);return row}
function active(){const now=Date.now();return list().filter(x=>!x.revokedAt&&new Date(x.expiresAt).getTime()>now)}
module.exports={FILE,list,save,getByToken,revoke,active};

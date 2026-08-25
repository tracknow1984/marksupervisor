const fs=require('fs');
const path=require('path');
const DATA_DIR=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const FILE=path.join(DATA_DIR,'compliance.json');
function blank(){return{documents:[]}}
function ensure(){try{fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(FILE))fs.writeFileSync(FILE,JSON.stringify(blank(),null,2))}catch(e){console.error('SV365 compliance store init failed:',e.message)}}
function read(){ensure();try{const d=JSON.parse(fs.readFileSync(FILE,'utf8'));return{documents:Array.isArray(d.documents)?d.documents:[]}}catch(e){console.error('SV365 compliance store read failed:',e.message);return blank()}}
function write(data){ensure();const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,FILE)}
function list(){return read().documents}
function get(id){return list().find(x=>String(x.id)===String(id))||null}
function save(doc){const d=read();const i=d.documents.findIndex(x=>String(x.id)===String(doc.id));if(i>=0)d.documents[i]=doc;else d.documents.push(doc);write(d);return doc}
function updateRecipient(documentId,employeeId,changes){const d=read();const doc=d.documents.find(x=>String(x.id)===String(documentId));if(!doc)return null;const row=(doc.recipients||[]).find(x=>String(x.employeeId)===String(employeeId));if(!row)return null;Object.assign(row,changes,{updatedAt:new Date().toISOString()});doc.updatedAt=new Date().toISOString();write(d);return{document:doc,recipient:row}}
function byToken(token){for(const doc of list()){const recipient=(doc.recipients||[]).find(x=>String(x.token)===String(token));if(recipient)return{document:doc,recipient}}return null}
function employeeAssignments(employeeId){return list().flatMap(doc=>(doc.recipients||[]).filter(r=>String(r.employeeId)===String(employeeId)).map(r=>({documentId:doc.id,subject:doc.subject,category:doc.category,priority:doc.priority,effectiveDate:doc.effectiveDate,dueDate:doc.dueDate,mandatory:doc.mandatory,status:r.status,sentAt:r.sentAt,openedAt:r.openedAt,completedAt:r.completedAt,lastResentAt:r.lastResentAt,resendCount:r.resendCount||0}))).sort((a,b)=>new Date(b.sentAt||0)-new Date(a.sentAt||0))}
module.exports={FILE,list,get,save,updateRecipient,byToken,employeeAssignments};

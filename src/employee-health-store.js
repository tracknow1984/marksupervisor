const fs=require('fs');
const path=require('path');
const DATA_DIR=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const FILE=path.join(DATA_DIR,'employee-health.json');
function blank(){return{employees:{}}}
function ensure(){try{fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(FILE))fs.writeFileSync(FILE,JSON.stringify(blank(),null,2))}catch(e){console.error('Employee health store init failed:',e.message)}}
function read(){ensure();try{const d=JSON.parse(fs.readFileSync(FILE,'utf8'));return{employees:d&&typeof d.employees==='object'&&d.employees?d.employees:{}}}catch(e){console.error('Employee health store read failed:',e.message);return blank()}}
function write(data){ensure();const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,FILE)}
function get(employeeId){const d=read();return d.employees[String(employeeId)]||null}
function recordSend(employeeId,entry){const d=read(),key=String(employeeId),current=d.employees[key]||{sendHistory:[]};const history=Array.isArray(current.sendHistory)?current.sendHistory:[];d.employees[key]={lastSentAt:entry.sentAt,lastSentTo:entry.to,lastSentPercent:entry.percent,lastSentOutstanding:Array.isArray(entry.outstanding)?entry.outstanding:[],lastMessageId:entry.messageId||'',sendHistory:[...history,entry].slice(-100)};write(d);return d.employees[key]}
module.exports={FILE,get,recordSend};
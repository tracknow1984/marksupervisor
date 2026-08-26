const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const DATA_DIR=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const FILE=path.join(DATA_DIR,'ewd.json');

function blank(){return{version:1,driverSecurity:{},sessions:[]}}
function ensure(){
  try{
    fs.mkdirSync(DATA_DIR,{recursive:true});
    if(!fs.existsSync(FILE))fs.writeFileSync(FILE,JSON.stringify(blank(),null,2));
  }catch(e){console.error('SV365 EWD store init failed:',e.message)}
}
function read(){
  ensure();
  try{
    const d=JSON.parse(fs.readFileSync(FILE,'utf8'));
    return{
      version:Number(d.version)||1,
      driverSecurity:d.driverSecurity&&typeof d.driverSecurity==='object'?d.driverSecurity:{},
      sessions:Array.isArray(d.sessions)?d.sessions:[]
    };
  }catch(e){console.error('SV365 EWD store read failed:',e.message);return blank()}
}
function write(data){
  ensure();
  const tmp=FILE+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(data,null,2));
  fs.renameSync(tmp,FILE);
}
function listSessions(){return read().sessions}
function getSession(id){return listSessions().find(x=>String(x.id)===String(id))||null}
function getActiveSession(employeeId){
  return [...listSessions()].reverse().find(x=>String(x.employeeId)===String(employeeId)&&x.status==='ACTIVE')||null;
}
function saveSession(rec){
  const d=read();
  const i=d.sessions.findIndex(x=>String(x.id)===String(rec.id));
  if(i>=0)d.sessions[i]=rec;else d.sessions.push(rec);
  write(d);return rec;
}
function updateSession(id,mutator){
  const d=read();
  const i=d.sessions.findIndex(x=>String(x.id)===String(id));
  if(i<0)return null;
  const item=d.sessions[i];
  if(typeof mutator==='function')mutator(item);else Object.assign(item,mutator||{});
  item.updatedAt=new Date().toISOString();
  d.sessions[i]=item;write(d);return item;
}
function sessionsForDriver(employeeId,sinceMs=0){
  return listSessions().filter(s=>String(s.employeeId)===String(employeeId)&&new Date(s.startedAt||0).getTime()>=sinceMs).sort((a,b)=>new Date(a.startedAt)-new Date(b.startedAt));
}
function setPin(employeeId,pin){
  const value=String(pin||'');
  if(!/^\d{4,8}$/.test(value))throw new Error('EWD PIN must be 4 to 8 digits');
  const d=read(),salt=crypto.randomBytes(16).toString('hex');
  const hash=crypto.scryptSync(value,salt,32).toString('hex');
  d.driverSecurity[String(employeeId)]={salt,hash,updatedAt:new Date().toISOString()};
  write(d);return true;
}
function hasPin(employeeId){return !!read().driverSecurity[String(employeeId)]}
function verifyPin(employeeId,pin){
  const sec=read().driverSecurity[String(employeeId)];
  if(!sec)return false;
  try{
    const a=Buffer.from(sec.hash,'hex');
    const b=crypto.scryptSync(String(pin||''),sec.salt,a.length);
    return a.length===b.length&&crypto.timingSafeEqual(a,b);
  }catch{return false}
}
function appendUnique(list,item,key='clientEventId'){
  if(item&&item[key]&&list.some(x=>String(x[key])===String(item[key])))return false;
  list.push(item);return true;
}
function addEvent(sessionId,event){return updateSession(sessionId,s=>{s.events=Array.isArray(s.events)?s.events:[];appendUnique(s.events,event)})}
function addGps(sessionId,point){return updateSession(sessionId,s=>{s.gps=Array.isArray(s.gps)?s.gps:[];if(!appendUnique(s.gps,point))return;if(s.gps.length>12000)s.gps=s.gps.slice(-12000)})}
function addAlert(sessionId,alert){return updateSession(sessionId,s=>{s.alerts=Array.isArray(s.alerts)?s.alerts:[];appendUnique(s.alerts,alert,'dedupeKey')})}
function addConfirmation(sessionId,confirmation){return updateSession(sessionId,s=>{s.confirmations=Array.isArray(s.confirmations)?s.confirmations:[];s.confirmations.push(confirmation)})}
function addAnnotation(sessionId,annotation){return updateSession(sessionId,s=>{s.annotations=Array.isArray(s.annotations)?s.annotations:[];s.annotations.push(annotation)})}

module.exports={FILE,listSessions,getSession,getActiveSession,saveSession,updateSession,sessionsForDriver,setPin,hasPin,verifyPin,addEvent,addGps,addAlert,addConfirmation,addAnnotation};

// One TMR browser across company processes on this single-instance server.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
function acquire(){
 const file=path.join(os.tmpdir(),'supervisor365-rego-browser.lock');
 try{const fd=fs.openSync(file,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid,at:Date.now()}));fs.closeSync(fd)}catch(e){
  if(e.code!=='EEXIST')throw e;
  let recovery,removed=false;
  try{recovery=fs.openSync(file+'.recovery','wx',0o600);const lock=JSON.parse(fs.readFileSync(file,'utf8'));let alive=true;try{process.kill(lock.pid,0)}catch(err){if(err.code==='ESRCH')alive=false}if(!alive&&Date.now()-lock.at>10000){fs.unlinkSync(file);removed=true}}catch{}finally{if(recovery!==undefined){fs.closeSync(recovery);try{fs.unlinkSync(file+'.recovery')}catch{}}}
  if(removed)return acquire();
  const busy=Error('Another registration check is running. Please wait.');busy.code='busy';throw busy;
 }
 let released=false;
 return()=>{if(released)return;released=true;const timer=setTimeout(()=>{try{fs.unlinkSync(file)}catch{}},10000);timer.unref()};
}
module.exports={acquire};

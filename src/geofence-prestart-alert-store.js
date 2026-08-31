const fs=require('fs');
const path=require('path');
const DATA_DIR=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const FILE=path.join(DATA_DIR,'geofence-prestart-alerts.json');

function blank(){return{version:1,rules:[],alerts:[],states:{}}}
function ensure(){try{fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(FILE))fs.writeFileSync(FILE,JSON.stringify(blank(),null,2))}catch(e){console.error('Geofence alert store init failed:',e.message)}}
function read(){ensure();try{const d=JSON.parse(fs.readFileSync(FILE,'utf8'));return{version:1,rules:Array.isArray(d.rules)?d.rules:[],alerts:Array.isArray(d.alerts)?d.alerts:[],states:d.states&&typeof d.states==='object'?d.states:{}}}catch(e){console.error('Geofence alert store read failed:',e.message);return blank()}}
function write(d){ensure();const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(d,null,2));fs.renameSync(tmp,FILE)}
function listRules(){return read().rules}
function getRule(id){return listRules().find(x=>String(x.id)===String(id))||null}
function saveRule(rule){const d=read(),now=new Date().toISOString();let row=d.rules.find(x=>String(x.id)===String(rule.id));if(row)Object.assign(row,rule,{updatedAt:now});else{row={...rule,createdAt:rule.createdAt||now,updatedAt:now};d.rules.push(row)}write(d);return row}
function deleteRule(id){const d=read(),before=d.rules.length;d.rules=d.rules.filter(x=>String(x.id)!==String(id));for(const key of Object.keys(d.states)){if(String(d.states[key]?.ruleId)===String(id))delete d.states[key]}write(d);return before!==d.rules.length}
function listAlerts(){return read().alerts.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))}
function addAlert(alert){const d=read();if(alert.dedupeKey&&d.alerts.some(x=>x.dedupeKey===alert.dedupeKey))return d.alerts.find(x=>x.dedupeKey===alert.dedupeKey);const row={...alert,createdAt:alert.createdAt||new Date().toISOString(),acknowledgedAt:null,acknowledgedBy:''};d.alerts.push(row);if(d.alerts.length>2500)d.alerts=d.alerts.slice(-2500);write(d);return row}
function acknowledge(id,by='Administrator'){const d=read(),row=d.alerts.find(x=>String(x.id)===String(id));if(!row)return null;row.acknowledgedAt=new Date().toISOString();row.acknowledgedBy=String(by||'Administrator');write(d);return row}
function getState(key){return read().states[key]||null}
function saveState(key,state){const d=read();d.states[key]={...(d.states[key]||{}),...state,updatedAt:new Date().toISOString()};write(d);return d.states[key]}
function summary(){const d=read(),open=d.alerts.filter(x=>!x.acknowledgedAt);return{rules:d.rules.filter(x=>x.enabled!==false).length,totalAlerts:d.alerts.length,openAlerts:open.length,critical:open.filter(x=>String(x.severity).toUpperCase()==='CRITICAL').length,lastAlertAt:d.alerts.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))[0]?.createdAt||null}}
module.exports={FILE,listRules,getRule,saveRule,deleteRule,listAlerts,addAlert,acknowledge,getState,saveState,summary};

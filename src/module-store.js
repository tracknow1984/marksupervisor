const fs=require('fs');
const path=require('path');
const DATA_DIR=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const FILE=path.join(DATA_DIR,'modules.json');

const CATALOG=Object.freeze([
  {id:'assets',name:'Assets',category:'Core',base:true,description:'Manage vehicles, plant, machinery, registrations and asset records.',features:['Asset register','Registration and expiry tracking','Asset details and QR access'],routes:['/assets']},
  {id:'employees',name:'Employees',category:'Core',base:true,description:'Manage employee profiles, contact details and staff compliance health.',features:['Employee profiles','Contact and licence records','Staff compliance health'],routes:['/employees']},
  {id:'live-gps',name:'Live GPS',category:'Core',base:true,description:'View linked assets live and manage the Wialon connection.',features:['Live fleet map','Asset GPS linking','GPS integration settings'],routes:['/gps','/gps-integration']},
  {id:'prestarts',name:'Pre-Starts & Defects',category:'Operations',description:'Add vehicle and plant inspections with history, configuration and defect follow-up.',features:['Mobile pre-starts','Inspection history','Checklist configuration','Vehicle defects'],routes:['/prestarts','/prestart-history','/prestart-config','/vehicle-defects']},
  {id:'maintenance',name:'Service & Maintenance',category:'Operations',description:'Plan upcoming services and retain a complete maintenance history.',features:['Service schedule','Due-service alerts','Service history'],routes:['/service','/service-history']},
  {id:'incidents',name:'Incident Management',category:'Safety',description:'Record, review and manage workplace and vehicle incidents.',features:['Incident register','Incident reports','Review and close-out workflow'],routes:['/incident-register']},
  {id:'compliance',name:'Compliance',category:'Safety',description:'Distribute controlled documents and track employee acknowledgements.',features:['Document distribution','Acknowledgement tracking','Outstanding compliance alerts'],routes:['/compliance']},
  {id:'ewd',name:'Electronic Work Diary',category:'Operations',description:'Manage driver work, rest, fatigue and active diary oversight.',features:['Driver EWD','Operations overview','Fatigue and break monitoring'],routes:['/ewd','/ewd-overview']},
  {id:'reports',name:'Reports',category:'Insights',description:'Run connected Wialon reports without leaving Supervisor365.',features:['Wialon report templates','Custom date ranges','CSV and PDF exports'],routes:['/reports']},
  {id:'geofence-alerts',name:'Geofence Alerts',category:'Safety',description:'Alert when tracked assets depart without a compliant pre-start.',features:['Departure monitoring','Pre-start compliance alerts','Live alert counts'],routes:['/gps-geofence-alerts'],requires:['prestarts']}
]);
const BASE_IDS=Object.freeze(CATALOG.filter(x=>x.base).map(x=>x.id));
const VALID_IDS=new Set(CATALOG.map(x=>x.id));

function blank(){return{version:1,companies:{}}}
function ensure(){try{fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(FILE))fs.writeFileSync(FILE,JSON.stringify(blank(),null,2))}catch(e){console.error('Module store init failed:',e.message)}}
function read(){ensure();try{const d=JSON.parse(fs.readFileSync(FILE,'utf8'));return{version:Number(d.version)||1,companies:d&&typeof d.companies==='object'&&d.companies?d.companies:{}}}catch(e){console.error('Module store read failed:',e.message);return blank()}}
function write(data){ensure();const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,FILE)}
function tenantKey(value){const key=String(value||'default').trim().replace(/[^a-zA-Z0-9_.-]/g,'-');return key||'default'}
function enabledIds(companyId){const d=read(),entry=d.companies[tenantKey(companyId)]||{},stored=Array.isArray(entry.enabled)?entry.enabled.filter(x=>VALID_IDS.has(x)):[];return[...new Set([...BASE_IDS,...stored])]}
function expandRequirements(ids){const out=new Set(ids);let changed=true;while(changed){changed=false;for(const item of CATALOG){if(!out.has(item.id))continue;for(const dep of item.requires||[])if(!out.has(dep)){out.add(dep);changed=true}}}return out}
function snapshot(companyId){const enabled=new Set(enabledIds(companyId));return{baseIds:[...BASE_IDS],enabledIds:[...enabled],items:CATALOG.map(item=>({...item,enabled:enabled.has(item.id),base:!!item.base}))}}
function commitSelection(companyId,moduleIds){
  if(!Array.isArray(moduleIds))throw new Error('Select the modules to commit');
  const requested=moduleIds.filter(x=>VALID_IDS.has(x));
  const selected=expandRequirements(new Set([...BASE_IDS,...requested]));
  const d=read(),key=tenantKey(companyId);
  d.companies[key]={enabled:[...selected].filter(x=>!BASE_IDS.includes(x)),updatedAt:new Date().toISOString()};
  write(d);
  return snapshot(key);
}
function setEnabled(companyId,moduleId,on){
  const id=String(moduleId||'').trim();
  if(!VALID_IDS.has(id))throw new Error('Unknown Supervisor365 module');
  if(BASE_IDS.includes(id)&&!on)throw new Error('Core modules are included in every Supervisor365 account');
  const d=read(),key=tenantKey(companyId),current=new Set(enabledIds(key));
  if(on){
    current.add(id);
    const expanded=expandRequirements(current);
    current.clear();
    expanded.forEach(x=>current.add(x));
  }else{
    current.delete(id);
    let changed=true;
    while(changed){changed=false;for(const item of CATALOG){if(current.has(item.id)&&(item.requires||[]).some(dep=>!current.has(dep))){current.delete(item.id);changed=true}}}
  }
  d.companies[key]={enabled:[...current].filter(x=>!BASE_IDS.includes(x)),updatedAt:new Date().toISOString()};
  write(d);
  return snapshot(key);
}
function routeMap(){return Object.fromEntries(CATALOG.map(item=>[item.id,[...item.routes]]))}

module.exports={FILE,CATALOG,BASE_IDS,tenantKey,enabledIds,snapshot,commitSelection,setEnabled,routeMap};

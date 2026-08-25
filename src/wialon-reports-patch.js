const express=require('express');
const reportsRouter=require('./routes/wialon-reports');
const {assets}=require('./store');

const WIALON_HOST='https://hst-api.wialon.com';
const REPORT_FLAGS=32769; // Hosting: base (1) + report templates (0x8000 / 32768)
const MAX_ROWS=5000;
const TZ_OFFSET=10*60*60;

async function call(svc,params={},sid=''){
  const body=new URLSearchParams({svc,params:JSON.stringify(params)});
  if(sid)body.set('sid',sid);
  const r=await fetch(WIALON_HOST+'/wialon/ajax.html',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!r.ok)throw new Error('Unable to contact Wialon');
  const d=await r.json();
  if(d&&d.error)throw new Error('Wialon error '+d.error);
  return d;
}
async function login(){
  const token=String(global.__SV365_WIALON_TOKEN||'').trim();
  if(!token)throw new Error('Wialon token has not been configured on this deployment');
  return call('token/login',{token});
}
async function cleanup(sid){try{await call('report/cleanup_result',{},sid)}catch{}}
const cell=v=>v==null?'':typeof v==='object'?(v.t!=null?String(v.t):v.v!=null?String(v.v):JSON.stringify(v)):String(v);
function linkedAssets(){return assets.filter(a=>a.wialonUnitId).map(a=>({id:a.id,name:a.name,rego:a.rego,type:a.type,wialonUnitId:String(a.wialonUnitId),wialonUnitName:a.wialonUnitName||''}))}
function parseTimes(b){const fm=Date.parse(String(b.from||'')),tm=Date.parse(String(b.to||''));if(!Number.isFinite(fm)||!Number.isFinite(tm)||tm<=fm)throw new Error('Select a valid report start and end time');if(tm-fm>90*86400000)throw new Error('Custom report ranges are limited to 90 days');if(tm>Date.now()+5*60000)throw new Error('Report end time cannot be in the future');return{fm,tm,from:Math.floor(fm/1000),to:Math.floor(tm/1000)}}
async function catalog(sid){
  const d=await call('core/search_items',{spec:{itemsType:'avl_resource',propName:'sys_name',propValueMask:'*',sortType:'sys_name'},force:1,flags:REPORT_FLAGS,count:0,from:0,to:0},sid);
  return (d.items||[]).map(r=>({id:String(r.id),name:r.nm||r.n||('Resource '+r.id),templates:Object.values(r.rep||{}).filter(t=>t&&String(t.ct||'')==='avl_unit').map(t=>({id:String(t.id),name:t.nm||t.n||('Report '+t.id),type:t.ct||''})).sort((a,b)=>a.name.localeCompare(b.name))})).filter(r=>r.templates.length);
}
async function templateData(sid,resourceId,templateId){const d=await call('report/get_report_data',{itemId:resourceId,col:[templateId],flags:4},sid);const t=Array.isArray(d)?d[0]:null;if(!t)throw new Error('Wialon report template was not found or is not accessible');if(String(t.ct||'')!=='avl_unit')throw new Error('Select a Wialon unit report template');return t}
async function execute(sid,resourceId,templateId,unitId,t){await cleanup(sid);return call('report/exec_report',{reportResourceId:resourceId,reportTemplateId:templateId,reportObjectId:unitId,reportObjectSecId:0,interval:{from:t.from,to:t.to,flags:0},tzOffset:TZ_OFFSET,lang:'en'},sid)}
async function flatRows(sid,tableIndex,rowCount){
  const wanted=Math.min(Math.max(0,Number(rowCount)||0),MAX_ROWS);if(!wanted)return[];
  try{
    const rows=await call('report/select_result_rows',{tableIndex,config:{type:'range',data:{from:0,to:wanted-1,level:0,flat:1,rawValues:0}}},sid);
    return (Array.isArray(rows)?rows:[]).slice(0,MAX_ROWS).map((r,i)=>({index:r.n??i,from:r.t1||null,to:r.t2||null,depth:Number(r.d)||0,cells:(Array.isArray(r.c)?r.c:[]).map(cell)}));
  }catch{
    const rows=await call('report/get_result_rows',{tableIndex,indexFrom:0,indexTo:wanted-1},sid);
    return (Array.isArray(rows)?rows:[]).map((r,i)=>({index:r.n??i,from:r.t1||null,to:r.t2||null,depth:Number(r.d)||0,cells:(Array.isArray(r.c)?r.c:[]).map(cell)}));
  }
}

const correctedRouter=express.Router();
correctedRouter.get('/api/wialon-reports/catalog',async(req,res)=>{let sid='';try{const a=await login();sid=a.eid;const resources=await catalog(sid);res.set('Cache-Control','no-store');res.json({resources,assets:linkedAssets(),templateCount:resources.reduce((n,r)=>n+r.templates.length,0),corrected:true})}catch(e){res.status(400).json({error:e.message})}finally{if(sid)cleanup(sid)}});
correctedRouter.post('/api/wialon-reports/run',async(req,res)=>{let sid='';try{const b=req.body||{},asset=assets.find(a=>String(a.id)===String(b.assetId));if(!asset)return res.status(404).json({error:'Asset not found'});if(!asset.wialonUnitId)return res.status(400).json({error:'This asset is not linked to Wialon'});const resourceId=Number(b.resourceId),templateId=Number(b.templateId),unitId=Number(asset.wialonUnitId);if(![resourceId,templateId,unitId].every(Number.isInteger))throw new Error('Invalid Wialon report selection');const t=parseTimes(b),a=await login();sid=a.eid;const tpl=await templateData(sid,resourceId,templateId),result=await execute(sid,resourceId,templateId,unitId,t),rr=result?.reportResult||{},tables=[];for(let i=0;i<(rr.tables||[]).length;i++){const x=rr.tables[i],rows=await flatRows(sid,i,x.r);tables.push({index:i,type:x.nm||'',name:x.text||x.name||('Table '+(i+1)),headers:Array.isArray(x.h)?x.h:[],totals:Array.isArray(x.t)?x.t.map(cell):[],rowCount:Number(x.r)||0,returnedRows:rows.length,truncated:Number(x.r)>MAX_ROWS,rows})}res.set('Cache-Control','no-store');res.json({asset:{id:asset.id,name:asset.name,rego:asset.rego,type:asset.type,wialonUnitId:String(asset.wialonUnitId)},template:{id:String(tpl.id||templateId),name:tpl.n||tpl.nm||('Report '+templateId),type:tpl.ct||'avl_unit'},resourceId:String(resourceId),from:new Date(t.fm).toISOString(),to:new Date(t.tm).toISOString(),stats:(rr.stats||[]).map(x=>Array.isArray(x)?{label:cell(x[0]),value:cell(x[1])}:{label:'',value:cell(x)}),attachments:rr.attachments||[],tables,corrected:true})}catch(e){console.error('Corrected Wialon report run failed:',e.message);res.status(400).json({error:e.message})}finally{if(sid)cleanup(sid)}});

// Chain the corrected report API first, then the original page/export router.
if(!express.__sv365WialonReportsJsonPatched){
  express.__sv365WialonReportsJsonPatched=true;
  const originalJson=express.json;
  express.json=function(...args){
    const parser=originalJson(...args);
    return function sv365JsonWithWialonReports(req,res,next){
      parser(req,res,err=>err?next(err):correctedRouter(req,res,()=>reportsRouter(req,res,next)));
    };
  };
}

if(!express.response.__sv365WialonReportsUiPatched){
  express.response.__sv365WialonReportsUiPatched=true;
  const originalSend=express.response.send;
  const navScript=String.raw`<script id="svWialonReportsNav">(()=>{let done=false;function apply(){if(done||document.querySelector('.smartChild[href="/reports"]')){done=true;return true}const groups=[...document.querySelectorAll('.smartGroup')],fleet=groups.find(g=>String(g.querySelector('.smartNavLabel')?.textContent||'').trim()==='Fleet');if(!fleet)return false;const children=fleet.querySelector('.smartChildren');if(!children)return false;const a=document.createElement('a');a.className='smartChild'+(location.pathname==='/reports'?' active':'');a.href='/reports';a.innerHTML='<span>Reports</span>';const live=children.querySelector('a[href="/gps"]');live?live.insertAdjacentElement('afterend',a):children.prepend(a);if(location.pathname==='/reports'){groups.forEach(g=>g.classList.remove('current','open'));fleet.classList.add('current','open');try{localStorage.setItem('sv365.smartGroup','fleet')}catch{}}done=true;return true}if(!apply()){const obs=new MutationObserver(()=>{if(apply())obs.disconnect()});obs.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{apply();obs.disconnect()},3000)}})();</script>`;
  const gpsIcon=String.raw`<script id="svReportsGpsIcon">(()=>{function apply(){if(document.getElementById('gpsReportsBtn'))return true;const playback=document.getElementById('gpsPlaybackBtn'),share=document.getElementById('shareLive');if(!playback&&!share)return false;const a=document.createElement('a');a.id='gpsReportsBtn';a.href='/reports';a.className='secondary';a.title='Reports';a.setAttribute('aria-label','Reports');a.style.cssText='width:42px;height:42px;padding:0;display:inline-grid;place-items:center;flex:0 0 42px;border-radius:10px;text-decoration:none';a.innerHTML='<svg viewBox="0 0 24 24" style="width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M5 20V10M12 20V4M19 20v-7"/><path d="M3 20h18"/></svg>';const ref=playback||share;ref.insertAdjacentElement('afterend',a);return true}if(!apply()){const o=new MutationObserver(()=>{if(apply())o.disconnect()});o.observe(document.body,{childList:true,subtree:true});setTimeout(()=>{apply();o.disconnect()},5000)}})();</script>`;
  express.response.send=function(body){
    const req=this.req;
    if(typeof body==='string'&&body.includes('</body>')&&!body.includes('svWialonReportsNav'))body=body.replace('</body>',navScript+'</body>');
    if(req&&req.path==='/gps'&&typeof body==='string'&&body.includes('</body>')&&!body.includes('svReportsGpsIcon'))body=body.replace('</body>',gpsIcon+'</body>');
    return originalSend.call(this,body);
  };
}

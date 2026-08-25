const express=require('express');
const router=express.Router();
const {page}=require('../layout');
const {assets}=require('../store');

const WIALON_HOST='https://hst-api.wialon.com';
const RESOURCE_REPORT_FLAGS=8193; // base + report templates
const MAX_RANGE_MS=90*24*60*60*1000;
const MAX_ROWS_PER_TABLE=5000;
const ROW_BATCH=500;
const TZ_OFFSET=10*60*60; // Brisbane / AEST

router.post('/api/gps/wialon/token',(req,res,next)=>{
  const token=String(req.body?.token||'').trim();
  if(token)global.__SV365_WIALON_TOKEN=token;
  next();
});

async function call(svc,params={},sid=''){
  const body=new URLSearchParams({svc,params:JSON.stringify(params)});
  if(sid)body.set('sid',sid);
  const r=await fetch(WIALON_HOST+'/wialon/ajax.html',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!r.ok)throw new Error('Unable to contact Wialon');
  const data=await r.json();
  if(data&&data.error)throw new Error('Wialon error '+data.error);
  return data;
}
async function rawCall(svc,params={},sid=''){
  const body=new URLSearchParams({svc,params:JSON.stringify(params)});
  if(sid)body.set('sid',sid);
  const r=await fetch(WIALON_HOST+'/wialon/ajax.html',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!r.ok)throw new Error('Unable to export Wialon report');
  const type=r.headers.get('content-type')||'';
  if(type.includes('application/json')){
    const d=await r.json();
    if(d&&d.error)throw new Error('Wialon error '+d.error);
    throw new Error(d?.reason||'Wialon did not return a report file');
  }
  return {buffer:Buffer.from(await r.arrayBuffer()),contentType:type};
}
async function login(){
  const token=String(global.__SV365_WIALON_TOKEN||'').trim();
  if(!token)throw new Error('Wialon token has not been configured on this deployment');
  return call('token/login',{token});
}
async function cleanup(sid){try{await call('report/cleanup_result',{},sid)}catch{}}
function num(v,name){const n=Number(v);if(!Number.isInteger(n)||n<=0)throw new Error('Invalid '+name);return n}
function interval(from,to){
  const fromMs=Date.parse(String(from||'')),toMs=Date.parse(String(to||''));
  if(!Number.isFinite(fromMs)||!Number.isFinite(toMs))throw new Error('Select a valid report start and end time');
  if(toMs<=fromMs)throw new Error('Report end time must be after the start time');
  if(toMs-fromMs>MAX_RANGE_MS)throw new Error('Custom report ranges are limited to 90 days');
  if(toMs>Date.now()+5*60*1000)throw new Error('Report end time cannot be in the future');
  return {fromMs,toMs,from:Math.floor(fromMs/1000),to:Math.floor(toMs/1000)};
}
function cellValue(v){
  if(v===null||v===undefined)return '';
  if(typeof v==='object'){
    if(v.t!==undefined&&v.t!==null)return String(v.t);
    if(v.v!==undefined&&v.v!==null)return String(v.v);
    try{return JSON.stringify(v)}catch{return String(v)}
  }
  return String(v);
}
function linkedAssets(){return assets.filter(a=>a.wialonUnitId).map(a=>({id:a.id,name:a.name,rego:a.rego,type:a.type,wialonUnitId:String(a.wialonUnitId),wialonUnitName:a.wialonUnitName||''}))}
async function catalogWithSession(sid){
  const data=await call('core/search_items',{spec:{itemsType:'avl_resource',propName:'sys_name',propValueMask:'*',sortType:'sys_name'},force:1,flags:RESOURCE_REPORT_FLAGS,count:0,from:0,to:0},sid);
  return (data.items||[]).map(r=>({
    id:String(r.id),name:r.nm||('Resource '+r.id),
    templates:Object.values(r.rep||{}).filter(t=>t&&String(t.ct||'')==='avl_unit').map(t=>({id:String(t.id),name:t.nm||('Report '+t.id),type:t.ct||''})).sort((a,b)=>a.name.localeCompare(b.name))
  })).filter(r=>r.templates.length);
}
async function verifyTemplate(sid,resourceId,templateId){
  const data=await call('report/get_report_data',{itemId:resourceId,col:[templateId]},sid);
  const t=Array.isArray(data)?data[0]:null;
  if(!t)throw new Error('Wialon report template was not found or is not accessible');
  if(String(t.ct||'')!=='avl_unit')throw new Error('This version of Supervisor365 Reports currently supports Wialon unit/asset report templates');
  return t;
}
async function executeReport({sid,resourceId,templateId,unitId,from,to}){
  await cleanup(sid);
  return call('report/exec_report',{
    reportResourceId:resourceId,
    reportTemplateId:templateId,
    reportObjectId:unitId,
    reportObjectSecId:0,
    interval:{from,to,flags:0},
    tzOffset:TZ_OFFSET,
    lang:'en'
  },sid);
}
async function rowsForTable(sid,tableIndex,count){
  const max=Math.min(Math.max(0,Number(count)||0),MAX_ROWS_PER_TABLE),rows=[];
  for(let start=0;start<max;start+=ROW_BATCH){
    const end=Math.min(max-1,start+ROW_BATCH-1);
    const batch=await call('report/get_result_rows',{tableIndex,indexFrom:start,indexTo:end},sid);
    if(!Array.isArray(batch)||!batch.length)break;
    rows.push(...batch.map(r=>({index:r.n,from:r.t1||null,to:r.t2||null,depth:Number(r.d)||0,cells:(Array.isArray(r.c)?r.c:[]).map(cellValue)})));
    if(batch.length<(end-start+1))break;
  }
  return rows;
}

router.get('/api/wialon-reports/catalog',async(req,res)=>{
  let sid='';
  try{
    const auth=await login();sid=auth.eid;
    const resources=await catalogWithSession(sid);
    res.set('Cache-Control','no-store');
    res.json({resources,assets:linkedAssets(),templateCount:resources.reduce((n,r)=>n+r.templates.length,0)});
  }catch(e){res.status(400).json({error:e.message})}finally{if(sid)cleanup(sid)}
});

router.post('/api/wialon-reports/run',async(req,res)=>{
  let sid='';
  try{
    const b=req.body||{},asset=assets.find(a=>String(a.id)===String(b.assetId));
    if(!asset)return res.status(404).json({error:'Asset not found'});
    if(!asset.wialonUnitId)return res.status(400).json({error:'This asset is not linked to Wialon'});
    const resourceId=num(b.resourceId,'report resource'),templateId=num(b.templateId,'report template'),unitId=num(asset.wialonUnitId,'Wialon unit');
    const times=interval(b.from,b.to),auth=await login();sid=auth.eid;
    const template=await verifyTemplate(sid,resourceId,templateId);
    const result=await executeReport({sid,resourceId,templateId,unitId,from:times.from,to:times.to});
    const rr=result?.reportResult||{},tables=[];
    for(let i=0;i<(rr.tables||[]).length;i++){
      const t=rr.tables[i],rows=await rowsForTable(sid,i,t.r);
      tables.push({index:i,type:t.nm||'',name:t.text||('Table '+(i+1)),headers:Array.isArray(t.h)?t.h:[],totals:Array.isArray(t.t)?t.t.map(cellValue):[],rowCount:Number(t.r)||0,returnedRows:rows.length,truncated:Number(t.r)>MAX_ROWS_PER_TABLE,rows});
    }
    res.set('Cache-Control','no-store');
    res.json({
      asset:{id:asset.id,name:asset.name,rego:asset.rego,type:asset.type,wialonUnitId:String(asset.wialonUnitId)},
      template:{id:String(template.id||templateId),name:template.n||('Report '+templateId),type:template.ct||'avl_unit'},
      resourceId:String(resourceId),from:new Date(times.fromMs).toISOString(),to:new Date(times.toMs).toISOString(),
      stats:(rr.stats||[]).map(x=>Array.isArray(x)?{label:cellValue(x[0]),value:cellValue(x[1])}:{label:'',value:cellValue(x)}),
      attachments:rr.attachments||[],tables
    });
  }catch(e){console.error('Wialon report run failed:',e.message);res.status(400).json({error:e.message||'Unable to run Wialon report'})}finally{if(sid)cleanup(sid)}
});

router.get('/api/wialon-reports/export',async(req,res)=>{
  let sid='';
  try{
    const asset=assets.find(a=>String(a.id)===String(req.query.assetId));
    if(!asset)return res.status(404).json({error:'Asset not found'});
    if(!asset.wialonUnitId)return res.status(400).json({error:'This asset is not linked to Wialon'});
    const resourceId=num(req.query.resourceId,'report resource'),templateId=num(req.query.templateId,'report template'),unitId=num(asset.wialonUnitId,'Wialon unit'),times=interval(req.query.from,req.query.to);
    const formats={pdf:{code:2,type:'application/pdf',ext:'pdf'},xlsx:{code:8,type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ext:'xlsx'},csv:{code:32,type:'text/csv; charset=utf-8',ext:'csv'}},fmt=formats[String(req.query.format||'pdf').toLowerCase()];
    if(!fmt)return res.status(400).json({error:'Export format must be PDF, XLSX or CSV'});
    const auth=await login();sid=auth.eid;
    await verifyTemplate(sid,resourceId,templateId);
    await executeReport({sid,resourceId,templateId,unitId,from:times.from,to:times.to});
    const safe=String((asset.rego||asset.id)+'-Wialon-Report').replace(/[^a-z0-9_-]+/gi,'-');
    const file=await rawCall('report/export_result',{format:fmt.code,pageOrientation:'landscape',pageSize:'a4',pageWidth:'2',coding:'utf8',delimiter:',',headings:'1',compress:'0',attachMap:'0',hideMapBasis:'0',outputFileName:safe},sid);
    res.set('Cache-Control','no-store');res.set('Content-Type',file.contentType||fmt.type);res.set('Content-Disposition','attachment; filename="'+safe+'.'+fmt.ext+'"');res.send(file.buffer);
  }catch(e){console.error('Wialon report export failed:',e.message);if(!res.headersSent)res.status(400).json({error:e.message||'Unable to export Wialon report'})}finally{if(sid)cleanup(sid)}
});

router.get('/reports',(req,res)=>res.send(page('reports','Reports',`
<style>
.repWrap{max-width:1320px;margin:0 auto}.repSetup{background:#fff;border:1px solid #e3e8ef;border-radius:14px;overflow:hidden;margin-bottom:18px}.repHead{padding:18px 20px;border-bottom:1px solid #e8edf3;background:#fbfcfe;display:flex;justify-content:space-between;gap:14px;align-items:center}.repHead h2{margin:0 0 4px}.repBody{padding:20px}.repGrid{display:grid;grid-template-columns:1.2fr 1fr;gap:14px}.repFull{grid-column:1/-1}.repRanges{display:flex;gap:7px;flex-wrap:wrap}.repRange{border:1px solid #d8e0e9;background:#fff;color:#465467;border-radius:8px;padding:8px 10px;font-size:10px;font-weight:850;cursor:pointer}.repRange.on{background:#101827;color:#fff;border-color:#101827}.repCustom{display:none;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}.repCustom.on{display:grid}.repStatus{padding:10px 12px;border:1px solid #dce7f5;background:#f7fbff;border-radius:9px;color:#65758a;font-size:11px}.repActions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.repResults{display:none}.repResults.on{display:block}.repHero{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.repStat{background:#fff;border:1px solid #e3e8ef;border-radius:11px;padding:14px}.repStat span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#7d8998;font-weight:850}.repStat b{display:block;font-size:19px;margin-top:5px;color:#263244}.repResultHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}.repExports{display:flex;gap:7px;flex-wrap:wrap}.repTablePanel{background:#fff;border:1px solid #e3e8ef;border-radius:13px;margin:0 0 15px;overflow:hidden}.repTableTitle{padding:13px 15px;border-bottom:1px solid #e8edf3;background:#fbfcfe;display:flex;justify-content:space-between;gap:10px}.repTableTitle b{font-size:12px}.repTableTitle span{font-size:10px;color:#7d8998}.repTablePanel table{font-size:10px}.repTablePanel th{white-space:nowrap}.repTablePanel td{max-width:360px;white-space:normal}.repEmpty{padding:30px;text-align:center;color:#8290a1}.repLoading{padding:30px;text-align:center;color:#637083}.repNote{margin-top:12px;font-size:10px;color:#7b8797}.repError{padding:12px 14px;background:#fff1f2;border:1px solid #fecaca;color:#a3262d;border-radius:9px;margin-bottom:14px}@media(max-width:800px){.repGrid,.repCustom,.repHero{grid-template-columns:1fr}.repFull{grid-column:auto}.repResultHead{flex-direction:column}.repExports{width:100%}.repExports button{flex:1}.repActions{display:grid}.repActions button{width:100%}}
</style>
<div class="repWrap"><section class="title"><div><h1>Reports</h1><p>Run your existing Wialon fleet reports directly inside Supervisor365.</p></div><a class="secondary" href="/gps">Live GPS</a></section>
<section class="repSetup"><div class="repHead"><div><h2>Run Wialon Report</h2><div class="sub">Report templates are managed in Wialon and made available here automatically.</div></div><div id="repConnection" class="repStatus">Checking Wialon…</div></div><div class="repBody"><div id="repError"></div><div class="repGrid"><div class="field"><label>Report Template *</label><select id="repTemplate"><option value="">Loading report templates…</option></select></div><div class="field"><label>Asset *</label><select id="repAsset"><option value="">Loading linked assets…</option></select></div><div class="field repFull"><label>Report Period</label><div class="repRanges"><button type="button" class="repRange on" data-range="today">Today</button><button type="button" class="repRange" data-range="yesterday">Yesterday</button><button type="button" class="repRange" data-range="week">Past 7 Days</button><button type="button" class="repRange" data-range="month">Past 30 Days</button><button type="button" class="repRange" data-range="custom">Custom Range</button></div><div id="repCustom" class="repCustom"><div class="field"><label>Start Date & Time</label><input id="repFrom" type="datetime-local"></div><div class="field"><label>End Date & Time</label><input id="repTo" type="datetime-local"></div></div></div></div><div class="repNote">Supervisor365 currently exposes Wialon report templates whose object type is <b>Unit</b>, matching them to Supervisor365 assets linked to Wialon.</div><div class="repActions"><button type="button" class="primary" id="runReport">Run Report</button></div></div></section>
<section id="repResults" class="repResults"><div class="repResultHead"><div><h2 id="repTitle" style="margin:0 0 4px">Report Results</h2><div class="sub" id="repSubtitle"></div></div><div class="repExports"><button class="secondary" data-export="pdf" type="button">Export PDF</button><button class="secondary" data-export="xlsx" type="button">Export XLSX</button><button class="secondary" data-export="csv" type="button">Export CSV</button></div></div><div id="repStats" class="repHero"></div><div id="repTables"></div></section></div>
<script>(()=>{const $=id=>document.getElementById(id),pad=n=>String(n).padStart(2,'0');let range='today',lastRun=null;const local=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes()),esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));function defaults(){const n=new Date(),s=new Date(n.getFullYear(),n.getMonth(),n.getDate());$('repFrom').value=local(s);$('repTo').value=local(n)}defaults();function period(){const n=new Date();if(range==='today')return[new Date(n.getFullYear(),n.getMonth(),n.getDate()),n];if(range==='yesterday'){const e=new Date(n.getFullYear(),n.getMonth(),n.getDate()),s=new Date(e);s.setDate(s.getDate()-1);return[s,e]}if(range==='week')return[new Date(n.getTime()-7*86400000),n];if(range==='month')return[new Date(n.getTime()-30*86400000),n];return[new Date($('repFrom').value),new Date($('repTo').value)]}document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{range=b.dataset.range;document.querySelectorAll('[data-range]').forEach(x=>x.classList.toggle('on',x===b));$('repCustom').classList.toggle('on',range==='custom');if(range==='custom')defaults()});async function loadCatalog(){try{const r=await fetch('/api/wialon-reports/catalog',{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load Wialon reports');$('repConnection').textContent=d.templateCount+' Wialon template'+(d.templateCount===1?'':'s')+' available';$('repTemplate').innerHTML='<option value="">Select report template…</option>'+d.resources.map(g=>'<optgroup label="'+esc(g.name)+'">'+g.templates.map(t=>'<option value="'+esc(g.id+'|'+t.id)+'">'+esc(t.name)+'</option>').join('')+'</optgroup>').join('');$('repAsset').innerHTML='<option value="">Select linked asset…</option>'+d.assets.map(a=>'<option value="'+esc(a.id)+'">'+esc((a.rego||a.id)+' · '+a.name)+'</option>').join('');if(!d.templateCount)$('repTemplate').innerHTML='<option value="">No Wialon unit report templates found</option>';if(!d.assets.length)$('repAsset').innerHTML='<option value="">No Wialon-linked assets found</option>'}catch(e){$('repConnection').textContent='Wialon not ready';$('repError').innerHTML='<div class="repError">'+esc(e.message)+' — enter the Wialon token under GPS Integration.</div>';$('repTemplate').innerHTML='<option value="">Wialon connection required</option>';$('repAsset').innerHTML='<option value="">Wialon connection required</option>'}}function valueCell(v){return esc(v===''?'—':v)}function render(d){lastRun={assetId:d.asset.id,resourceId:d.resourceId,templateId:d.template.id,from:d.from,to:d.to};$('repResults').classList.add('on');$('repTitle').textContent=d.template.name;$('repSubtitle').textContent=(d.asset.rego||d.asset.id)+' · '+d.asset.name+' · '+new Date(d.from).toLocaleString('en-AU')+' → '+new Date(d.to).toLocaleString('en-AU');const stats=d.stats||[];$('repStats').innerHTML=(stats.length?stats.slice(0,12):[{label:'Tables',value:d.tables.length},{label:'Report',value:'Completed'}]).map(s=>'<div class="repStat"><span>'+esc(s.label||'Statistic')+'</span><b>'+esc(s.value||'—')+'</b></div>').join('');$('repTables').innerHTML=(d.tables||[]).length?d.tables.map(t=>{const heads=t.headers||[],rows=t.rows||[];return '<section class="repTablePanel"><div class="repTableTitle"><b>'+esc(t.name)+'</b><span>'+t.returnedRows.toLocaleString('en-AU')+' of '+t.rowCount.toLocaleString('en-AU')+' rows'+(t.truncated?' · limited to 5,000':'')+'</span></div><div class="tablewrap"><table><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+r.cells.map(c=>'<td>'+valueCell(c)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+Math.max(1,heads.length)+'"><div class="repEmpty">No rows returned for this table.</div></td></tr>')+(t.totals?.length?'<tr>'+t.totals.map((x,i)=>'<td><b>'+valueCell(x)+'</b></td>').join('')+'</tr>':'')+'</tbody></table></div></section>'}).join(''):'<div class="repEmpty">This Wialon report completed but returned no tables for the selected period.</div>';$('repResults').scrollIntoView({behavior:'smooth',block:'start'})} $('runReport').onclick=async()=>{const template=$('repTemplate').value,assetId=$('repAsset').value;if(!template)return alert('Select a Wialon report template.');if(!assetId)return alert('Select an asset.');const [resourceId,templateId]=template.split('|'),[from,to]=period();if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime()))return alert('Enter valid report dates.');if(to<=from)return alert('End date must be after start date.');const b=$('runReport');b.disabled=true;b.textContent='Running Wialon report…';$('repError').innerHTML='';$('repTables').innerHTML='<div class="repLoading">Running report and loading Wialon tables…</div>';$('repResults').classList.add('on');try{const r=await fetch('/api/wialon-reports/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assetId,resourceId,templateId,from:from.toISOString(),to:to.toISOString()})}),d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to run report');render(d)}catch(e){$('repResults').classList.remove('on');$('repError').innerHTML='<div class="repError">'+esc(e.message)+'</div>'}finally{b.disabled=false;b.textContent='Run Report'}};document.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{if(!lastRun)return alert('Run a report first.');const q=new URLSearchParams({...lastRun,format:b.dataset.export});location.href='/api/wialon-reports/export?'+q.toString()});loadCatalog()})();</script>`)));

module.exports=router;

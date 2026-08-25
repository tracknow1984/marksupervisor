const express=require('express');
const {assets}=require('./store');

const WIALON_HOST='https://hst-api.wialon.com';
const MAX_ROWS=5000;
const BATCH=500;

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
  if(!token)throw new Error('Wialon token is not available to Reports. Re-enter it under GPS Integration.');
  return call('token/login',{token});
}
async function cleanup(sid){try{await call('report/cleanup_result',{},sid)}catch{}}
function cell(v){
  if(v===null||v===undefined)return '';
  if(typeof v==='object'){
    if(v.t!==undefined&&v.t!==null)return String(v.t);
    if(v.v!==undefined&&v.v!==null)return String(v.v);
    try{return JSON.stringify(v)}catch{return String(v)}
  }
  return String(v);
}
function rowCells(r){return (Array.isArray(r?.c)?r.c:Array.isArray(r?.cells)?r.cells:[]).map(cell)}
function mapRow(r,index,depth=0){return{index:r?.n??r?.index??index,from:r?.t1??r?.from??null,to:r?.t2??r?.to??null,depth:Number.isFinite(Number(r?.level))?Number(r.level):depth,cells:rowCells(r)}}
function flattenTree(rows,depth=0,out=[]){
  for(let i=0;i<(Array.isArray(rows)?rows:[]).length&&out.length<MAX_ROWS;i++){
    const r=rows[i];out.push(mapRow(r,out.length,depth));
    const kids=Array.isArray(r?.r)?r.r:Array.isArray(r?.rows)?r.rows:[];
    if(kids.length)flattenTree(kids,depth+1,out);
  }
  return out;
}
function tableMeta(t,i){
  const rowCount=Number(t?.r??t?.rows??0)||0;
  const headers=Array.isArray(t?.h)?t.h:Array.isArray(t?.header)?t.header:[];
  const totals=Array.isArray(t?.t)?t.t:Array.isArray(t?.total)?t.total:[];
  return{index:i,type:String(t?.nm??t?.name??''),name:String(t?.text??t?.label??t?.display_name??t?.name??('Table '+(i+1))),rowCount,headers,totals:totals.map(cell),maxLevel:Number(t?.level??0)||0};
}
async function selectRows(sid,tableIndex,rowCount){
  const wanted=Math.min(Math.max(0,rowCount),MAX_ROWS);if(!wanted)return[];
  const configs=[{type:'range',data:{from:0,to:wanted-1,level:0,flat:1,rawValues:0}},{type:'range',data:{from:0,to:wanted-1,level:0,flat:1}}];
  for(const config of configs){
    try{const d=await call('report/select_result_rows',{tableIndex,config},sid),rows=flattenTree(d);if(rows.length)return rows.slice(0,MAX_ROWS)}catch{}
  }
  return[];
}
async function standardRows(sid,tableIndex,rowCount){
  const wanted=Math.min(Math.max(0,rowCount),MAX_ROWS),out=[];
  for(let start=0;start<wanted;start+=BATCH){
    const end=Math.min(wanted-1,start+BATCH-1),batch=await call('report/get_result_rows',{tableIndex,indexFrom:start,indexTo:end},sid);
    if(!Array.isArray(batch)||!batch.length)break;
    for(let i=0;i<batch.length&&out.length<MAX_ROWS;i++)out.push(mapRow(batch[i],out.length,0));
    if(batch.length<(end-start+1))break;
  }
  return out;
}
async function rowsForTable(sid,meta){if(!meta.rowCount)return[];const selected=await selectRows(sid,meta.index,meta.rowCount);if(selected.length)return selected;return standardRows(sid,meta.index,meta.rowCount)}
function parseTimes(b){const fm=Date.parse(String(b.from||'')),tm=Date.parse(String(b.to||''));if(!Number.isFinite(fm)||!Number.isFinite(tm)||tm<=fm)throw new Error('Select a valid report start and end time');if(tm-fm>90*86400000)throw new Error('Custom report ranges are limited to 90 days');if(tm>Date.now()+5*60000)throw new Error('Report end time cannot be in the future');return{fm,tm,from:Math.floor(fm/1000),to:Math.floor(tm/1000)}}
async function templateData(sid,resourceId,templateId){
  const attempts=[{itemId:resourceId,col:[templateId],flags:4},{itemId:resourceId,col:[templateId]}];let last=null;
  for(const params of attempts){try{const d=await call('report/get_report_data',params,sid),t=Array.isArray(d)?d[0]:null;if(t)return t}catch(e){last=e}}
  throw last||new Error('Wialon report template was not found or is not accessible');
}
function tzFromAuth(auth){const raw=Number(auth?.user?.prp?.tz);return Number.isFinite(raw)&&raw!==0?raw:10*60*60}

const router=express.Router();
router.post('/api/wialon-reports/run',async(req,res)=>{
  let sid='';
  try{
    const b=req.body||{},asset=assets.find(a=>String(a.id)===String(b.assetId));
    if(!asset)return res.status(404).json({error:'Asset not found'});
    if(!asset.wialonUnitId)return res.status(400).json({error:'This asset is not linked to Wialon'});
    const resourceId=Number(b.resourceId),templateId=Number(b.templateId),unitId=Number(asset.wialonUnitId);
    if(![resourceId,templateId,unitId].every(n=>Number.isInteger(n)&&n>0))throw new Error('Invalid Wialon report selection');
    const times=parseTimes(b),auth=await login();sid=auth.eid;
    const tpl=await templateData(sid,resourceId,templateId),templateType=String(tpl.ct||tpl.type||'avl_unit');
    if(templateType!=='avl_unit')throw new Error('This saved report is not a Wialon unit report.');
    await cleanup(sid);
    const result=await call('report/exec_report',{reportResourceId:resourceId,reportTemplateId:templateId,reportObjectId:unitId,reportObjectSecId:0,interval:{from:times.from,to:times.to,flags:0},tzOffset:tzFromAuth(auth),lang:String(auth?.user?.prp?.language||'en').slice(0,2)||'en'},sid);
    const rr=result?.reportResult||{},tables=[];
    for(let i=0;i<(Array.isArray(rr.tables)?rr.tables:[]).length;i++){
      const meta=tableMeta(rr.tables[i],i),rows=await rowsForTable(sid,meta);
      tables.push({...meta,returnedRows:rows.length,truncated:meta.rowCount>MAX_ROWS,rows});
    }
    const stats=Array.isArray(rr.stats)?rr.stats:[];
    res.set('Cache-Control','no-store');
    res.json({asset:{id:asset.id,name:asset.name,rego:asset.rego,type:asset.type,wialonUnitId:String(asset.wialonUnitId)},template:{id:String(tpl.id||templateId),name:tpl.n||tpl.nm||tpl.name||('Report '+templateId),type:templateType},resourceId:String(resourceId),from:new Date(times.fm).toISOString(),to:new Date(times.tm).toISOString(),stats:stats.map(x=>Array.isArray(x)?{label:cell(x[0]),value:cell(x[1])}:{label:cell(x?.name||x?.label||''),value:cell(x?.value??x)}),attachments:Array.isArray(rr.attachments)?rr.attachments:[],tables,diagnostics:{msgsRendered:Number(rr.msgsRendered??rr.messagesRendered??0)||0,tableCount:tables.length,totalRows:tables.reduce((n,t)=>n+t.returnedRows,0)},rowsFix:true});
  }catch(e){console.error('Wialon report rows fix failed:',e.message);res.status(400).json({error:e.message||'Unable to load Wialon report rows'})}
  finally{if(sid)cleanup(sid)}
});

if(!express.__sv365WialonReportRowsFixed){
  express.__sv365WialonReportRowsFixed=true;
  const originalJson=express.json;
  express.json=function(...args){
    const parser=originalJson(...args);
    return function sv365JsonWithReportRowsFix(req,res,next){parser(req,res,err=>err?next(err):router(req,res,next))};
  };
}

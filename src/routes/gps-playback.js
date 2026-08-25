const express=require('express');
const router=express.Router();
const {assets}=require('../store');

const WIALON_HOST='https://hst-api.wialon.com';
const MAX_RANGE_MS=31*24*60*60*1000;
const LOAD_LIMIT=20000;
const OUTPUT_LIMIT=5000;

router.post('/api/gps/wialon/token',(req,res,next)=>{
  const token=String(req.body?.token||'').trim();
  if(token)global.__SV365_WIALON_TOKEN=token;
  next();
});

async function wialonCall(svc,params={},sid=''){
  const body=new URLSearchParams({svc,params:JSON.stringify(params)});
  if(sid)body.set('sid',sid);
  const r=await fetch(WIALON_HOST+'/wialon/ajax.html',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!r.ok)throw new Error('Unable to contact Wialon');
  const data=await r.json();
  if(data&&data.error)throw new Error('Wialon error '+data.error);
  return data;
}
async function login(){
  const token=String(global.__SV365_WIALON_TOKEN||'').trim();
  if(!token)throw new Error('Wialon token has not been configured on this deployment');
  return wialonCall('token/login',{token});
}
function distanceMetres(a,b){
  const rad=n=>n*Math.PI/180,R=6371000;
  const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
  const x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function compact(points){
  if(points.length<=OUTPUT_LIMIT)return points;
  const step=Math.ceil(points.length/OUTPUT_LIMIT),out=[];
  for(let i=0;i<points.length;i+=step)out.push(points[i]);
  const last=points[points.length-1];
  if(out[out.length-1]!==last)out.push(last);
  return out;
}

router.get('/api/gps/playback',async(req,res)=>{
  try{
    const assetId=String(req.query.assetId||'').trim();
    const asset=assets.find(a=>String(a.id)===assetId);
    if(!asset)return res.status(404).json({error:'Asset not found'});
    if(!asset.wialonUnitId)return res.status(400).json({error:'This asset is not linked to a Wialon unit'});
    const fromMs=Date.parse(String(req.query.from||'')),toMs=Date.parse(String(req.query.to||''));
    if(!Number.isFinite(fromMs)||!Number.isFinite(toMs))return res.status(400).json({error:'Select a valid playback start and end time'});
    if(toMs<=fromMs)return res.status(400).json({error:'Playback end time must be after the start time'});
    if(toMs-fromMs>MAX_RANGE_MS)return res.status(400).json({error:'Custom playback ranges are limited to 31 days'});
    if(toMs>Date.now()+5*60*1000)return res.status(400).json({error:'Playback end time cannot be in the future'});

    const auth=await login();
    const data=await wialonCall('messages/load_interval',{
      itemId:Number(asset.wialonUnitId),
      timeFrom:Math.floor(fromMs/1000),
      timeTo:Math.floor(toMs/1000),
      flags:0,
      flagsMask:65280,
      loadCount:LOAD_LIMIT
    },auth.eid);
    const raw=Array.isArray(data?.messages)?data.messages:[];
    const points=raw.map(m=>{
      const p=m&&m.pos;
      const lat=Number(p?.y),lon=Number(p?.x),time=Number(m?.t),speed=Number(p?.s)||0,course=Number(p?.c)||0;
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(time)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
      return{lat,lon,time,speed,course};
    }).filter(Boolean).sort((a,b)=>a.time-b.time);
    let metres=0,maxSpeed=0;
    for(let i=0;i<points.length;i++){
      maxSpeed=Math.max(maxSpeed,Number(points[i].speed)||0);
      if(i)metres+=distanceMetres(points[i-1],points[i]);
    }
    const output=compact(points);
    res.set('Cache-Control','no-store');
    res.json({
      asset:{id:asset.id,name:asset.name,rego:asset.rego,type:asset.type,wialonUnitId:String(asset.wialonUnitId)},
      from:new Date(fromMs).toISOString(),to:new Date(toMs).toISOString(),
      sourceMessageCount:Number(data?.count)||raw.length,
      pointCount:points.length,displayPointCount:output.length,truncated:points.length>=LOAD_LIMIT,
      distanceKm:Math.round(metres/10)/100,maxSpeedKmh:Math.round(maxSpeed),points:output
    });
  }catch(e){
    console.error('GPS playback failed:',e.message);
    res.status(400).json({error:e.message||'Unable to load GPS playback'});
  }
});

module.exports=router;

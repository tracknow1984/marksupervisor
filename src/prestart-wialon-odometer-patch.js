const express=require('express');
const {assets}=require('./store');
const db=require('./persistent-store');

const WIALON_HOST='https://hst-api.wialon.com';
const ROAD_ODOMETER_TYPES=new Set(['Prime Mover','Rigid Truck','Bus','Car','Motorcycle','Light Vehicle']);
const MAX_WIALON_KM=4294967;
let mirroredWialonToken='';

const clean=v=>String(v??'').trim();
const linkedAsset=id=>assets.find(a=>String(a.id)===String(id));
const syncEligible=a=>!!a&&ROAD_ODOMETER_TYPES.has(String(a.type||''));

async function wialonCall(svc,params={},sid=''){
  const body=new URLSearchParams({svc,params:JSON.stringify(params)});
  if(sid)body.set('sid',sid);
  const r=await fetch(WIALON_HOST+'/wialon/ajax.html',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const data=await r.json();
  if(data&&data.error){
    const e=new Error(data.error===7?'Wialon access denied. The token/user needs Edit counters permission for this unit.':'Wialon error '+data.error);
    e.wialonCode=data.error;
    throw e;
  }
  return data;
}

async function login(){
  if(!mirroredWialonToken){
    const e=new Error('Wialon counter sync is not ready. Re-save the Wialon token in GPS Integration so Supervisor365 can securely use it for odometer reconciliation.');
    e.code='WIALON_TOKEN_NOT_MIRRORED';
    throw e;
  }
  return wialonCall('token/login',{token:mirroredWialonToken});
}

function counterMode(cfl){
  const mode=Number(cfl||0)&3;
  return mode===1?'Mileage sensor':mode===2?'Relative odometer':mode===3?'GPS + ignition':'GPS';
}

async function currentCounter(asset){
  if(!asset?.wialonUnitId)throw new Error('This asset is not linked to a Wialon unit.');
  const auth=await login();
  const data=await wialonCall('core/search_item',{id:Number(asset.wialonUnitId),flags:8193},auth.eid);
  const item=data?.item||{};
  if([1,2].includes(Number(item.mu))){
    const e=new Error('This Wialon unit is configured in US/imperial measurement units. Automatic odometer write-back is disabled until the unit is changed to metric.');
    e.code='WIALON_IMPERIAL_UNIT';
    throw e;
  }
  const km=Number(item.cnm);
  if(!Number.isFinite(km))throw new Error('Wialon did not return a valid mileage counter for this unit.');
  return {sid:auth.eid,km,raw:item,mode:counterMode(item.cfl),autoCalculation:!!(Number(item.cfl||0)&0x100)};
}

function reviewThreshold(beforeKm){
  const n=Math.abs(Number(beforeKm)||0);
  return Math.max(1000,Math.min(5000,n*0.05));
}

function persistSync(prestartId,payload){
  if(!prestartId)return;
  const rec=db.getPrestart(prestartId);
  if(!rec)return;
  rec.wialonOdometerSync=payload;
  db.savePrestart(rec);
}

const router=express.Router();

// Mirror the token only after the existing GPS Integration endpoint confirms it is valid.
router.use((req,res,next)=>{
  if(req.method==='POST'&&req.path==='/api/gps/wialon/token'){
    const candidate=clean(req.body?.token);
    const originalJson=res.json.bind(res);
    res.json=(payload)=>{
      if(res.statusCode<400&&payload?.ok&&candidate)mirroredWialonToken=candidate;
      return originalJson(payload);
    };
  }
  next();
});

router.get('/api/prestarts/wialon-odometer/:assetId',async(req,res)=>{
  try{
    res.set('Cache-Control','no-store');
    const asset=linkedAsset(req.params.assetId);
    if(!asset)return res.status(404).json({error:'Asset not found'});
    if(!asset.wialonUnitId)return res.json({linked:false,syncEligible:false,assetId:asset.id});
    const counter=await currentCounter(asset);
    res.json({
      linked:true,
      syncEligible:syncEligible(asset),
      assetId:asset.id,
      assetName:asset.name,
      assetType:asset.type,
      rego:asset.rego,
      unitId:String(asset.wialonUnitId),
      unitName:asset.wialonUnitName||'',
      wialonKm:counter.km,
      calculationMode:counter.mode,
      autoCalculation:counter.autoCalculation,
      note:syncEligible(asset)?'Driver dash kilometres can be reconciled back to the Wialon mileage counter.':'Wialon kilometres are shown as reference only because this asset type may use an hours reading.'
    });
  }catch(e){
    res.status(e.code==='WIALON_TOKEN_NOT_MIRRORED'?503:400).json({error:e.message,code:e.code||'',wialonCode:e.wialonCode||null});
  }
});

router.post('/api/prestarts/wialon-odometer/sync',async(req,res)=>{
  const asset=linkedAsset(req.body?.assetId);
  const prestartId=clean(req.body?.prestartId);
  const driverKm=Number(req.body?.reading);
  const forced=req.body?.force===true;
  const now=new Date().toISOString();
  try{
    if(!asset)return res.status(404).json({error:'Asset not found'});
    if(!asset.wialonUnitId)return res.status(400).json({error:'This asset is not linked to Wialon',code:'WIALON_NOT_LINKED'});
    if(!syncEligible(asset))return res.status(409).json({error:'Automatic Wialon odometer write-back is disabled for this asset type because the pre-start reading may be engine hours rather than vehicle kilometres.',code:'READING_TYPE_NOT_KILOMETRES'});
    if(!Number.isFinite(driverKm)||driverKm<0||driverKm>MAX_WIALON_KM)return res.status(400).json({error:'Enter a valid vehicle odometer between 0 and '+MAX_WIALON_KM.toLocaleString('en-AU')+' km.',code:'INVALID_ODOMETER'});

    const before=await currentCounter(asset);
    const rounded=Math.round(driverKm);
    const variance=rounded-before.km;
    const threshold=reviewThreshold(before.km);
    if(!forced&&Math.abs(variance)>threshold){
      return res.status(409).json({
        error:'The dash odometer differs significantly from Wialon. Confirm the correction before updating the Wialon counter.',
        code:'ODOMETER_VARIANCE_REVIEW_REQUIRED',
        beforeKm:before.km,
        driverKm:rounded,
        varianceKm:variance,
        reviewThresholdKm:threshold,
        unitName:asset.wialonUnitName||''
      });
    }

    const result=await wialonCall('unit/update_mileage_counter',{itemId:Number(asset.wialonUnitId),newValue:rounded},before.sid);
    const afterKm=Number(result?.cnm);
    const audit={
      status:'SYNCED',
      source:'prestart_driver_dash',
      unitId:String(asset.wialonUnitId),
      unitName:asset.wialonUnitName||'',
      beforeKm:before.km,
      driverKm:rounded,
      varianceKm:variance,
      afterKm:Number.isFinite(afterKm)?afterKm:rounded,
      calculationMode:before.mode,
      autoCalculation:before.autoCalculation,
      forced,
      syncedAt:now
    };
    persistSync(prestartId,audit);
    asset.reading=rounded;
    res.set('Cache-Control','no-store');
    res.json({ok:true,...audit});
  }catch(e){
    const audit={status:'FAILED',source:'prestart_driver_dash',unitId:String(asset?.wialonUnitId||''),unitName:asset?.wialonUnitName||'',driverKm:Number.isFinite(driverKm)?Math.round(driverKm):null,error:e.message,failedAt:now};
    persistSync(prestartId,audit);
    res.status(e.code==='WIALON_TOKEN_NOT_MIRRORED'?503:400).json({error:e.message,code:e.code||'WIALON_SYNC_FAILED',wialonCode:e.wialonCode||null});
  }
});

if(!express.__sv365PrestartWialonOdometerJsonPatched){
  express.__sv365PrestartWialonOdometerJsonPatched=true;
  const originalJson=express.json;
  express.json=function(...args){
    const parser=originalJson(...args);
    return function sv365JsonWithPrestartWialonOdometer(req,res,next){
      parser(req,res,err=>err?next(err):router(req,res,next));
    };
  };
}

if(!express.response.__sv365PrestartWialonOdometerUiPatched){
  express.response.__sv365PrestartWialonOdometerUiPatched=true;
  const originalSend=express.response.send;
  const ui=String.raw`
<style id="sv365PrestartWialonOdoStyle">
.wialonOdoAssist{margin-top:7px;padding:9px 10px;border:1px solid #d7e5f2;border-radius:9px;background:#f8fbff;font-size:10.5px;line-height:1.45;color:#5a697a}.wialonOdoAssist b{color:#1e5f91}.wialonOdoAssist.good{border-color:#b9dfc8;background:#f5fcf8;color:#3e6950}.wialonOdoAssist.warn{border-color:#edd49b;background:#fffaf0;color:#875f14}.wialonOdoAssist.bad{border-color:#efc4c0;background:#fff7f6;color:#9e352d}.wialonOdoVariance{margin-top:4px;font-weight:800}.wialonSyncTag{display:inline-flex;margin-left:5px;padding:2px 5px;border-radius:999px;background:#e9f4ff;color:#176eb5;font-size:8.5px;font-weight:900;letter-spacing:.25px}
</style>
<script id="sv365PrestartWialonOdoScript">(()=>{
  if(window.__sv365PrestartWialonOdo)return;window.__sv365PrestartWialonOdo=true;
  const nativeFetch=window.fetch.bind(window),fmt=n=>Number(n).toLocaleString('en-AU',{maximumFractionDigits:0});
  function helperFor(input){let h=input.parentElement?.querySelector('.wialonOdoAssist');if(h)return h;h=document.createElement('div');h.className='wialonOdoAssist';input.insertAdjacentElement('afterend',h);return h}
  function varianceText(input,h){const base=Number(input.dataset.wialonKm),dash=Number(input.value);if(!Number.isFinite(base)||!Number.isFinite(dash))return;const d=Math.round(dash-base),sign=d>0?'+':'';let v=h.querySelector('.wialonOdoVariance');if(!v){v=document.createElement('div');v.className='wialonOdoVariance';h.appendChild(v)}v.textContent='Dash vs Wialon: '+sign+fmt(d)+' km';v.style.color=Math.abs(d)<=100?'#17884c':Math.abs(d)<=1000?'#9a6b10':'#b42318'}
  async function loadInput(input){
    if(input.dataset.wialonChecked)return;input.dataset.wialonChecked='1';
    const assetId=String(input.id||'').replace(/^odo_/,''),h=helperFor(input);h.textContent='Checking Wialon odometer…';
    let userEdited=false;input.addEventListener('input',()=>{userEdited=true;varianceText(input,h)});
    try{
      const r=await nativeFetch('/api/prestarts/wialon-odometer/'+encodeURIComponent(assetId),{cache:'no-store'}),d=await r.json();
      if(!r.ok)throw new Error(d.error||'Unable to read Wialon odometer');
      if(!d.linked){h.remove();return}
      input.dataset.wialonKm=String(d.wialonKm);
      input.dataset.wialonSyncEligible=d.syncEligible?'1':'0';
      if(d.syncEligible){
        const label=input.closest('.field')?.querySelector('label');if(label)label.innerHTML='Vehicle Odometer (km) * <span class="wialonSyncTag">WIALON SYNC</span>';
        if(!userEdited)input.value=String(Math.round(Number(d.wialonKm)));
        h.className='wialonOdoAssist good';h.innerHTML='<b>Wialon GPS odometer: '+fmt(d.wialonKm)+' km</b> · '+(d.unitName||'Linked unit')+'<br>Enter the odometer shown on the vehicle dash. The difference will be reconciled back to Wialon when this signed pre-start is saved.';
        varianceText(input,h);
      }else{
        h.className='wialonOdoAssist warn';h.innerHTML='<b>Wialon GPS distance: '+fmt(d.wialonKm)+' km</b> · Reference only. Automatic write-back is disabled for this asset type because the pre-start field may be an hours reading.';
      }
    }catch(e){h.className='wialonOdoAssist bad';h.textContent=e.message}
  }
  function scan(){document.querySelectorAll('#forms input[id^="odo_"]').forEach(loadInput)}
  scan();new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});

  window.fetch=async(input,init)=>{
    const url=typeof input==='string'?input:(input&&input.url)||'',method=String(init?.method||'GET').toUpperCase();
    const response=await nativeFetch(input,init);
    if((url==='/api/prestarts'||url.endsWith('/api/prestarts'))&&method==='POST'&&response.ok&&init?.body){
      try{
        const sent=JSON.parse(init.body),saved=await response.clone().json(),rows=Array.isArray(sent.records)?sent.records:[],created=Array.isArray(saved)?saved:[];
        const failures=[];
        for(const rec of created){
          const row=rows.find(x=>String(x.assetId)===String(rec.assetId)),odo=document.getElementById('odo_'+rec.assetId);
          if(!row||odo?.dataset.wialonSyncEligible!=='1')continue;
          let sync=await nativeFetch('/api/prestarts/wialon-odometer/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assetId:rec.assetId,prestartId:rec.id,reading:row.reading,force:false})}),data=await sync.json();
          if(sync.status===409&&data.code==='ODOMETER_VARIANCE_REVIEW_REQUIRED'){
            const difference=Math.round(Number(data.varianceKm)||0),ok=confirm('Odometer check for '+(rec.rego||rec.assetName)+':\n\nWialon: '+fmt(data.beforeKm)+' km\nVehicle dash: '+fmt(data.driverKm)+' km\nDifference: '+(difference>0?'+':'')+fmt(difference)+' km\n\nThis difference is larger than normal. Update Wialon to the vehicle dash reading anyway?');
            if(ok){sync=await nativeFetch('/api/prestarts/wialon-odometer/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assetId:rec.assetId,prestartId:rec.id,reading:row.reading,force:true})});data=await sync.json()}
          }
          if(!sync.ok)failures.push((rec.rego||rec.assetName)+': '+(data.error||'Wialon odometer sync failed'));
        }
        if(failures.length)alert('The pre-start was saved, but the following Wialon odometer update needs attention:\n\n'+failures.join('\n'));
      }catch(e){console.warn('Pre-start Wialon odometer reconciliation failed:',e)}
    }
    return response;
  };
})();</script>`;
  express.response.send=function(body){
    if(this.req?.path==='/prestarts'&&typeof body==='string'&&body.includes('</body>')&&!body.includes('sv365PrestartWialonOdoScript'))body=body.replace('</body>',ui+'</body>');
    return originalSend.call(this,body);
  };
}

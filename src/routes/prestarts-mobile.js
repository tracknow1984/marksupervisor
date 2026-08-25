const express=require('express');
const router=express.Router();
const {page}=require('../layout');
const {assets,prestartHistory,vehicleDefects}=require('../store');

const activeAssets=()=>assets.filter(a=>!['Retired','Decommissioned','Sold'].includes(a.status));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const priorityFor=(assetType,label)=>{
  const s=String(label||'').toLowerCase();
  if(/brake|steering|tyre|wheel|seat belt|king pin|tow eye|coupling|breakaway|air system|chassis crack/.test(s))return 'HIGH';
  if(/light|warning|wiper|mirror|leak|suspension|bearing|exhaust/.test(s))return 'MEDIUM';
  return 'LOW';
};

router.post('/api/prestarts',(req,res)=>{
  const {sessionId,inspector,records}=req.body||{};
  if(!Array.isArray(records)||!records.length)return res.status(400).json({error:'No inspection records supplied'});
  const created=[];
  for(const row of records){
    const asset=assets.find(a=>a.id===row.assetId);
    if(!asset)continue;
    if(!row.signature)return res.status(400).json({error:`Signature required for ${asset.name}`});
    const failedRows=(row.results||[]).filter(x=>x.value==='fail');
    const now=new Date().toISOString();
    const rec={
      id:'PS-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),
      sessionId:sessionId||'SESSION-'+Date.now(),assetId:asset.id,assetName:asset.name,assetType:asset.type,rego:asset.rego,
      inspector:inspector||'Current User',completedAt:now,inspectionDate:row.inspectionDate,location:row.location||asset.location,
      address:row.address||'',latitude:Number.isFinite(Number(row.latitude))?Number(row.latitude):null,
      longitude:Number.isFinite(Number(row.longitude))?Number(row.longitude):null,
      locationAccuracy:Number.isFinite(Number(row.locationAccuracy))?Number(row.locationAccuracy):null,
      locationCapturedAt:row.locationCapturedAt||null,reading:Number(row.reading)||0,notes:row.notes||'',results:row.results||[],
      signature:row.signature,status:failedRows.length?'Failed':'Passed',failedCount:failedRows.length
    };
    prestartHistory.push(rec);
    asset.reading=rec.reading;
    for(const fail of failedRows){
      vehicleDefects.push({
        id:'DEF-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),
        assetId:asset.id,assetName:asset.name,assetType:asset.type,rego:asset.rego,prestartId:rec.id,prestartItemId:fail.itemId||null,
        defect:fail.label||'Pre-Start defect',reportedAt:now,reportedBy:rec.inspector,reading:rec.reading,
        location:rec.address||rec.location||'',priority:priorityFor(asset.type,fail.label),status:'OPEN',action:'',resolutionNotes:'',
        updatedAt:now,resolvedAt:null,closedAt:null
      });
    }
    asset.openDefects=vehicleDefects.filter(d=>d.assetId===asset.id&&!['RESOLVED','CLOSED'].includes(d.status)).length;
    created.push(rec);
  }
  res.status(201).json(created);
});

router.get('/prestarts',(req,res)=>{
  const available=activeAssets();
  const seed=JSON.stringify(available).replace(/</g,'\\u003c');
  const primaryOptions=available.map(a=>`<option value="${esc(a.id)}">${esc(a.rego||a.id)} · ${esc(a.name)} · ${esc(a.type)}</option>`).join('');
  res.send(page('prestarts','Pre-Starts',`
<style>
.preMobile{max-width:760px;margin:0 auto}.preHero{margin-bottom:16px}.preHero h1{margin:0 0 5px;font-size:28px}.preHero p{margin:0;color:#748094}.stepCard,.inspectionCard{background:#fff;border:1px solid #e3e8ef;border-radius:14px;margin-bottom:14px}.stepCard{padding:16px}.bigSelect{width:100%;min-height:54px;font-size:16px;padding:12px;border:1px solid #d5dde7;border-radius:10px;background:#fff}.assetPreview{margin-top:10px;padding:12px;border:1px solid #dce7f5;background:#f7fbff;border-radius:10px}.towPrompt{display:flex;gap:10px;margin-top:14px;padding:13px;border:1px solid #e3e8ef;border-radius:10px;background:#fafbfc}.towPrompt input{width:20px;height:20px}.secondaryArea{margin-top:12px}.secondaryRow{display:flex;gap:8px}.selectedAsset{display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid #e3e8ef;border-radius:10px;margin-top:8px}.mobilePrimary{width:100%;min-height:56px;font-size:16px}.stickyStart{position:sticky;bottom:8px;z-index:5;padding-top:12px;background:linear-gradient(transparent,#f5f7fa 28%);margin-bottom:22px}.inspectionTitle{padding:16px;background:#f8fafc;border-bottom:1px solid #e7edf3}.metaGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px}.checkItem{padding:14px 16px;border-top:1px solid #edf1f5}.checkLabel{font-weight:700;margin-bottom:10px}.tapChoices{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tapChoice{min-height:54px;border:1px solid #d7dee8;background:#fff;border-radius:10px;font-weight:800;font-size:16px}.tapChoice.pass.on{background:#eaf8f0;color:#17884c;border-color:#a7dfbe}.tapChoice.fail.on{background:#ffe9e9;color:#b42318;border-color:#f3b0b0}.mobileSubmit{display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:24px}.signature{height:160px}.locationCard{grid-column:1/-1;border:1px solid #dce7f5;background:#f8fbff;border-radius:12px;padding:12px}.locationTop{display:flex;align-items:center;justify-content:space-between;gap:10px}.locationState{font-size:13px;font-weight:700}.locationState.ok{color:#17884c}.locationState.warn{color:#ad7410}.locationBtn{min-height:42px;padding:8px 12px}.locationMeta{font-size:11px;color:#7b8797;margin-top:5px}.mapPreview{margin-top:10px;border:1px solid #dbe3ec;border-radius:10px;overflow:hidden;background:#eef3f8}.mapPreview iframe{display:block;width:100%;height:180px;border:0}.addressInput{margin-top:10px}@media(max-width:700px){.content{padding:14px}.top{padding:0 14px}.preHero h1{font-size:23px}.metaGrid{grid-template-columns:1fr}.secondaryRow{display:grid;grid-template-columns:1fr}.secondaryRow button{width:100%}.locationTop{align-items:flex-start}.mapPreview iframe{height:150px}}
</style>
<div class="preMobile">
  <div id="selectStep">
    <section class="preHero"><h1>Start Pre-Start</h1><p>Select the asset you are operating and complete the inspection.</p></section>
    <section class="stepCard">
      <h3>Primary Asset</h3>
      <select id="primary" class="bigSelect"><option value="">Select primary asset...</option>${primaryOptions}</select>
      <div id="primaryPreview"></div>
      <label class="towPrompt"><input type="checkbox" id="hasTow"><span><b>Is there another asset in tow you would like to add for a pre-start?</b></span></label>
      <div id="secondaryArea" class="secondaryArea hidden"><div class="secondaryRow"><select id="secondary" class="bigSelect"><option value="">Select secondary asset...</option></select><button class="secondary" type="button" id="addSecondary">＋ Add Asset</button></div><div id="secondaryList"></div></div>
    </section>
    <div class="stickyStart"><button class="primary mobilePrimary" type="button" id="beginBtn" disabled>Continue to Inspection →</button></div>
  </div>
  <div id="inspectStep" class="hidden"><div class="sessionbar"><strong>Pre-Start Inspection</strong><div id="summary" class="sub"></div></div><div id="forms"></div><div class="mobileSubmit"><button class="primary" type="button" id="submitBtn">Submit Signed Inspection</button><button class="secondary" type="button" id="backBtn">Back</button></div></div>
</div>
<script>
(()=>{
  const $=id=>document.getElementById(id);
  const allAssets=${seed};
  let secondaryIds=[],sessionAssets=[],answers={},itemsByAsset={};
  let gps={latitude:null,longitude:null,accuracy:null,capturedAt:null};
  const primary=$('primary'),secondary=$('secondary'),hasTow=$('hasTow'),beginBtn=$('beginBtn');
  const option=a=>'<option value="'+a.id+'">'+(a.rego||a.id)+' · '+a.name+' · '+a.type+'</option>';

  function renderPrimary(){
    const a=allAssets.find(x=>String(x.id)===String(primary.value));
    beginBtn.disabled=!a;
    $('primaryPreview').innerHTML=a?'<div class="assetPreview"><b>'+a.name+'</b><div class="sub">'+a.type+' · '+(a.rego||a.id)+'</div></div>':'';
  }
  function renderSecondaryOptions(){
    secondary.innerHTML='<option value="">Select secondary asset...</option>'+allAssets.filter(a=>a.id!==primary.value&&!secondaryIds.includes(a.id)).map(option).join('');
  }
  function renderSecondaryList(){
    $('secondaryList').innerHTML=secondaryIds.map(id=>{const a=allAssets.find(x=>x.id===id);return a?'<div class="selectedAsset"><div><b>'+a.name+'</b><div class="sub">'+(a.rego||a.id)+' · '+a.type+'</div></div><button type="button" class="mini" data-remove="'+id+'">Remove</button></div>':''}).join('');
    $('secondaryList').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{secondaryIds=secondaryIds.filter(x=>x!==b.dataset.remove);renderSecondaryList();renderSecondaryOptions();});
  }
  primary.addEventListener('change',()=>{secondaryIds=secondaryIds.filter(id=>id!==primary.value);renderPrimary();renderSecondaryList();renderSecondaryOptions();});
  hasTow.addEventListener('change',()=>{const on=hasTow.checked;$('secondaryArea').classList.toggle('hidden',!on);if(!on){secondaryIds=[];secondary.value='';renderSecondaryList();renderSecondaryOptions();}});
  $('addSecondary').addEventListener('click',()=>{if(!secondary.value)return;if(!secondaryIds.includes(secondary.value))secondaryIds.push(secondary.value);secondary.value='';renderSecondaryList();renderSecondaryOptions();});
  renderPrimary();renderSecondaryOptions();

  function applyGpsToForms(){
    if(gps.latitude===null)return;
    for(const a of sessionAssets){
      const loc=$('loc_'+a.id),state=$('gpsState_'+a.id),meta=$('gpsMeta_'+a.id),map=$('map_'+a.id);
      if(loc)loc.value=gps.latitude.toFixed(6)+', '+gps.longitude.toFixed(6);
      if(state){state.textContent='Current location captured';state.className='locationState ok';}
      if(meta)meta.textContent='GPS accuracy: ±'+Math.round(gps.accuracy||0)+' m · captured '+new Date(gps.capturedAt).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'});
      if(map){const bbox=(gps.longitude-0.004)+','+(gps.latitude-0.003)+','+(gps.longitude+0.004)+','+(gps.latitude+0.003);map.innerHTML='<iframe title="Current GPS location" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox='+encodeURIComponent(bbox)+'&layer=mapnik&marker='+gps.latitude+'%2C'+gps.longitude+'"></iframe>';}
    }
  }
  function captureLocation(){
    if(!navigator.geolocation){sessionAssets.forEach(a=>{const s=$('gpsState_'+a.id);if(s){s.textContent='GPS is not supported on this device';s.className='locationState warn';}});return;}
    sessionAssets.forEach(a=>{const s=$('gpsState_'+a.id);if(s)s.textContent='Getting current location…';});
    navigator.geolocation.getCurrentPosition(pos=>{gps={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy,capturedAt:new Date(pos.timestamp||Date.now()).toISOString()};applyGpsToForms();},()=>{sessionAssets.forEach(a=>{const s=$('gpsState_'+a.id);if(s){s.textContent='Unable to get GPS — enter location manually';s.className='locationState warn';}});},{enableHighAccuracy:true,timeout:10000,maximumAge:30000});
  }

  async function startInspection(){
    const p=allAssets.find(a=>String(a.id)===String(primary.value));
    if(!p)return alert('Select a primary asset first.');
    beginBtn.disabled=true;beginBtn.textContent='Loading...';
    try{
      sessionAssets=[p,...secondaryIds.map(id=>allAssets.find(a=>a.id===id)).filter(Boolean)];
      $('forms').innerHTML='';answers={};itemsByAsset={};gps={latitude:null,longitude:null,accuracy:null,capturedAt:null};
      for(const [idx,a] of sessionAssets.entries()){
        const r=await fetch('/api/prestart-items?assetType='+encodeURIComponent(a.type));
        if(!r.ok)throw new Error('Unable to load checklist for '+a.name);
        const items=await r.json();itemsByAsset[a.id]=items;
        const checks=items.filter(x=>!['Odometer Reading','Inspection Date'].includes(x.label));
        const checkHtml=checks.map(x=>'<div class="checkItem"><div class="checkLabel">'+x.label+(x.required?' <span class="req">*</span>':'')+'</div><div class="tapChoices"><button type="button" class="tapChoice pass" data-a="'+a.id+'" data-i="'+x.id+'" data-v="pass">PASS</button><button type="button" class="tapChoice fail" data-a="'+a.id+'" data-i="'+x.id+'" data-v="fail">FAIL</button></div></div>').join('');
        $('forms').insertAdjacentHTML('beforeend','<section class="inspectionCard"><div class="inspectionTitle"><b>'+(idx===0?'Primary':'Towed Asset')+' · '+a.name+'</b><div class="sub">'+(a.rego||a.id)+' · '+a.type+'</div></div><div class="metaGrid"><div class="field"><label>Odometer / Hours *</label><input id="odo_'+a.id+'" type="number" inputmode="numeric" value="'+(a.reading||'')+'"></div><div class="field"><label>Inspection Date *</label><input id="date_'+a.id+'" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div><div class="locationCard"><div class="locationTop"><div><div id="gpsState_'+a.id+'" class="locationState">Waiting for device location…</div><div id="gpsMeta_'+a.id+'" class="locationMeta">Allow location access when your phone asks.</div></div><button type="button" class="secondary locationBtn" data-refresh-location>↻ Refresh GPS</button></div><div class="field addressInput"><label>GPS Location</label><input id="loc_'+a.id+'" placeholder="Captured automatically"></div><div class="field addressInput"><label>Address</label><input id="addr_'+a.id+'" placeholder="Optional manual address"></div><div id="map_'+a.id+'" class="mapPreview"></div></div></div>'+checkHtml+'<div class="notes"><b>Additional Notes</b><textarea id="notes_'+a.id+'"></textarea></div><div class="sigbox"><b>Inspector Signature *</b><div class="sub" style="margin:6px 0 10px">Sign with your finger below.</div><canvas class="signature" id="sig_'+a.id+'"></canvas><button class="secondary" type="button" data-clear="'+a.id+'" style="margin-top:8px">Clear Signature</button></div></section>');
      }
      $('forms').querySelectorAll('.tapChoice').forEach(b=>b.addEventListener('click',()=>{answers[b.dataset.a]=answers[b.dataset.a]||{};answers[b.dataset.a][b.dataset.i]=b.dataset.v;b.parentElement.querySelectorAll('.tapChoice').forEach(x=>x.classList.remove('on'));b.classList.add('on');}));
      $('forms').querySelectorAll('[data-clear]').forEach(b=>b.addEventListener('click',()=>clearSignature(b.dataset.clear)));
      $('forms').querySelectorAll('[data-refresh-location]').forEach(b=>b.addEventListener('click',captureLocation));
      sessionAssets.forEach(a=>setupSignature(a.id));
      $('summary').textContent=sessionAssets.map(a=>a.name).join(' + ');
      $('selectStep').classList.add('hidden');$('inspectStep').classList.remove('hidden');window.scrollTo(0,0);setTimeout(captureLocation,200);
    }catch(e){alert(e.message||'Unable to start inspection');}
    finally{beginBtn.disabled=!primary.value;beginBtn.textContent='Continue to Inspection →';}
  }
  beginBtn.addEventListener('click',startInspection);

  function setupSignature(id){
    const c=$('sig_'+id);if(!c)return;const r=c.getBoundingClientRect(),ratio=window.devicePixelRatio||1;c.width=Math.max(280,Math.floor(r.width*ratio));c.height=Math.floor(160*ratio);const ctx=c.getContext('2d');ctx.scale(ratio,ratio);ctx.lineWidth=2;ctx.lineCap='round';c.dataset.signed='0';let down=false;const pos=e=>{const b=c.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top}};c.onpointerdown=e=>{down=true;c.setPointerCapture(e.pointerId);const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)};c.onpointermove=e=>{if(!down)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();c.dataset.signed='1'};c.onpointerup=()=>down=false;c.onpointercancel=()=>down=false;
  }
  function clearSignature(id){const c=$('sig_'+id);if(c){c.getContext('2d').clearRect(0,0,c.width,c.height);c.dataset.signed='0';}}
  $('backBtn').addEventListener('click',()=>{$('inspectStep').classList.add('hidden');$('selectStep').classList.remove('hidden');renderPrimary();});
  $('submitBtn').addEventListener('click',async()=>{
    const records=[];
    for(const a of sessionAssets){
      const checks=(itemsByAsset[a.id]||[]).filter(x=>!['Odometer Reading','Inspection Date'].includes(x.label));
      if(!$('odo_'+a.id).value)return alert('Enter odometer/hours for '+a.name);
      if(checks.some(x=>x.required&&(!answers[a.id]||!answers[a.id][x.id])))return alert('Complete all required checks for '+a.name);
      const c=$('sig_'+a.id);if(!c||c.dataset.signed!=='1')return alert('Please sign for '+a.name);
      records.push({assetId:a.id,inspectionDate:$('date_'+a.id).value,location:$('loc_'+a.id).value,address:$('addr_'+a.id).value,latitude:gps.latitude,longitude:gps.longitude,locationAccuracy:gps.accuracy,locationCapturedAt:gps.capturedAt,reading:$('odo_'+a.id).value,notes:$('notes_'+a.id).value,signature:c.toDataURL('image/png'),results:checks.map(x=>({itemId:x.id,label:x.label,value:answers[a.id][x.id]}))});
    }
    const submit=$('submitBtn');submit.disabled=true;submit.textContent='Saving...';
    try{const r=await fetch('/api/prestarts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'SESSION-'+Date.now(),inspector:'Current User',records})});const saved=await r.json();if(!r.ok)throw new Error(saved.error||'Unable to save inspection');alert(saved.length+' signed inspection'+(saved.length===1?'':'s')+' saved');location.href='/prestarts';}catch(e){alert(e.message||'Unable to save inspection');}finally{submit.disabled=false;submit.textContent='Submit Signed Inspection';}
  });
})();
</script>`));
});

module.exports=router;

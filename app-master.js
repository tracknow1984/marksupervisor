const express=require('express');
const app=express();
const PORT=process.env.PORT||3000;
const {assets}=require('./src/store');
const operationsDb=require('./src/persistent-store');
app.use(express.json({limit:'60mb'}));

const htmlEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));

app.get('/api/diagnostics/prestart-defects',(req,res)=>{
  try{
    const prestarts=operationsDb.listPrestarts();
    const defects=operationsDb.listDefects();
    const latest=[...prestarts].sort((a,b)=>new Date(b.completedAt||0)-new Date(a.completedAt||0))[0]||null;
    if(!latest)return res.json({ok:false,storeFile:operationsDb.FILE,prestartCount:0,defectCount:defects.length,message:'No persisted pre-starts found on this running instance.'});
    const failed=(latest.results||[]).filter(x=>String(x.value||'').trim().toLowerCase()==='fail');
    const linked=defects.filter(d=>String(d.prestartId)===String(latest.id));
    const missing=failed.filter(f=>!linked.some(d=>String(d.prestartItemId)===String(f.itemId)));
    res.set('Cache-Control','no-store');
    res.json({ok:missing.length===0&&linked.length>=failed.length,storeFile:operationsDb.FILE,prestartCount:prestarts.length,defectCount:defects.length,latestPrestart:{id:latest.id,completedAt:latest.completedAt,assetId:latest.assetId,assetName:latest.assetName,rego:latest.rego,status:latest.status,failedCountStored:latest.failedCount,failedItems:failed.map(x=>({itemId:x.itemId,label:x.label,value:x.value}))},linkedDefects:linked.map(d=>({id:d.id,prestartItemId:d.prestartItemId,defect:d.defect,status:d.status,priority:d.priority})),missingDefects:missing.map(x=>({itemId:x.itemId,label:x.label})),diagnosis:failed.length===0?'Latest persisted pre-start contains no FAIL values.':missing.length?'FAIL values were persisted but matching defect records are missing.':'Latest failed items have matching persisted defect records.'});
  }catch(e){res.status(500).json({ok:false,error:e.message,storeFile:operationsDb.FILE})}
});

app.use((req,res,next)=>{
  const originalSend=res.send.bind(res);
  res.send=(body)=>{
    if(typeof body==='string'&&req.path==='/prestarts'){
      body=body.replace("&z=17&output=embed\"></iframe>'}}function captureLocation","&z=17&output=embed\"></iframe>'}}}function captureLocation");
      const available=assets.filter(a=>!['Retired','Decommissioned','Sold'].includes(a.status));
      const options=available.map(a=>`<option value="${htmlEsc(a.id)}">${htmlEsc(a.rego||a.id)} · ${htmlEsc(a.name)} · ${htmlEsc(a.type)}</option>`).join('');
      body=body.replace('<select id="primary" class="bigSelect"><option value="">Select primary asset...</option></select>',`<select id="primary" class="bigSelect"><option value="">Select primary asset...</option>${options}</select>`);
      const selectorSafety=`<script>(()=>{const p=document.getElementById('primary'),b=document.getElementById('beginBtn'),preview=document.getElementById('primaryPreview');if(!p)return;const assets=${JSON.stringify(available).replace(/</g,'\\u003c')};const sync=()=>{const a=assets.find(x=>String(x.id)===String(p.value));if(b)b.disabled=!a;if(preview)preview.innerHTML=a?'<div class="assetPreview"><b>'+a.name+'</b><div class="sub">'+(a.type||'')+' · '+(a.rego||a.id)+'</div></div>':''};p.addEventListener('change',sync);sync()})();</script>`;
      body=body.replace('</body>',selectorSafety+'</body>');
    }
    if(typeof body==='string'&&body.includes('<span class="navlabel">WORKFORCE</span>')){
      if(!body.includes('href="/vehicle-defects"')){const active=req.path==='/vehicle-defects'?'on':'';const defectsLink=`<a class="${active}" href="/vehicle-defects" title="Vehicle Defects"><span class="navicon"><svg viewBox="0 0 24 24"><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".8"/></svg></span><span class="navtext">Vehicle Defects</span><span class="navchev">›</span></a>`;body=body.replace('<span class="navlabel">WORKFORCE</span>',defectsLink+'<span class="navlabel">WORKFORCE</span>')}
      if(!body.includes('href="/incident-register"')){const active=req.path.startsWith('/incident-register')?'on':'';const incidentLink=`<a class="${active}" href="/incident-register" title="Incident Register"><span class="navicon"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="M16 13v5M13.5 15.5h5"/></svg></span><span class="navtext">Incident Register</span><span class="navchev">›</span></a>`;body=body.replace('<span class="navlabel">WORKFORCE</span>',incidentLink+'<span class="navlabel">WORKFORCE</span>')}
      if(!body.includes('href="/service"')){const active=req.path==='/service'?'on':'';const serviceLink=`<a class="${active}" href="/service" title="Service Schedule"><span class="navicon"><svg viewBox="0 0 24 24"><path d="M5 7h14v12H5z"/><path d="M8 4v6M16 4v6M8 14h3M13 14h3"/></svg></span><span class="navtext">Service Schedule</span><span class="navchev">›</span></a>`;body=body.replace('<span class="navlabel">WORKFORCE</span>',serviceLink+'<span class="navlabel">WORKFORCE</span>')}
      if(!body.includes('href="/service-history"')){const active=req.path==='/service-history'?'on':'';const serviceHistoryLink=`<a class="${active}" href="/service-history" title="Service History"><span class="navicon"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><span class="navtext">Service History</span><span class="navchev">›</span></a>`;body=body.replace('<span class="navlabel">WORKFORCE</span>',serviceHistoryLink+'<span class="navlabel">WORKFORCE</span>')}
      if(!body.includes('href="/prestart-history"')){const active=req.path==='/prestart-history'?'on':'';const historyLink=`<a class="${active}" href="/prestart-history" title="Pre-Start History"><span class="navicon"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><span class="navtext">Pre-Start History</span><span class="navchev">›</span></a>`;body=body.replace('<span class="navlabel">WORKFORCE</span>',historyLink+'<span class="navlabel">WORKFORCE</span>')}
      if(!body.includes('href="/gps"')){const active=req.path==='/gps'?'on':'';const gpsLink=`<a class="${active}" href="/gps" title="Live GPS"><span class="navicon"><svg viewBox="0 0 24 24"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg></span><span class="navtext">Live GPS</span><span class="navchev">›</span></a>`;body=body.replace('<span class="navlabel">WORKFORCE</span>',gpsLink+'<span class="navlabel">WORKFORCE</span>')}
      if(!body.includes('href="/gps-integration"')){const active=req.path==='/gps-integration'?'on':'';const cfgLink=`<a class="${active}" href="/gps-integration" title="GPS Integration"><span class="navicon"><svg viewBox="0 0 24 24"><path d="M8 12h8M12 8v8"/><circle cx="12" cy="12" r="8"/></svg></span><span class="navtext">GPS Integration</span><span class="navchev">›</span></a>`;body=body.replace('<span class="navlabel">WORKFORCE</span>',cfgLink+'<span class="navlabel">WORKFORCE</span>')}
    }
    if(typeof body==='string'&&req.path==='/prestarts'&&req.query.asset&&body.includes('id="primary"')){const assetId=JSON.stringify(String(req.query.asset));const preselect=`<script>(()=>{const assetId=${assetId};const apply=()=>{const el=document.getElementById('primary');if(!el)return false;const match=[...el.options].some(o=>o.value===assetId);if(!match)return true;el.value=assetId;el.dispatchEvent(new Event('change',{bubbles:true}));const preview=document.getElementById('primaryPreview');if(preview)preview.scrollIntoView({behavior:'smooth',block:'center'});return true};if(!apply()){let tries=0;const timer=setInterval(()=>{tries++;if(apply()||tries>20)clearInterval(timer)},100)}})();</script>`;body=body.replace('</body>',preselect+'</body>')}
    return originalSend(body);
  };next();
});
app.use(require('./src/routes/assets'));
app.use(require('./src/routes/asset-qr'));
app.use(require('./src/routes/employees'));
app.use(require('./src/routes/prestart-config'));
app.use(require('./src/routes/prestart-submit'));
app.use(require('./src/routes/prestarts-mobile'));
app.use(require('./src/routes/prestart-history'));
app.use(require('./src/routes/vehicle-defects-v2'));
app.use(require('./src/routes/vehicle-defects'));
app.use(require('./src/routes/incident-management'));
app.use(require('./src/routes/incident-register'));
app.use(require('./src/routes/services'));
app.use(require('./src/routes/gps'));
app.get('/defects',(req,res)=>res.redirect('/vehicle-defects'));
app.get('/vehicleDefects',(req,res)=>res.redirect('/vehicle-defects'));
app.get('/',(req,res)=>res.redirect('/assets'));
app.use((req,res)=>res.status(404).send('Supervisor365 page not found'));
app.listen(PORT,'0.0.0.0',()=>console.log('Supervisor365 modular master running on '+PORT));

const express=require('express');
const app=express();
const PORT=process.env.PORT||3000;
app.use(express.json({limit:'8mb'}));

// Shared navigation extensions and light cross-page wiring.
app.use((req,res,next)=>{
  const originalSend=res.send.bind(res);
  res.send=(body)=>{
    if(typeof body==='string'&&body.includes('<span class="navlabel">WORKFORCE</span>')){
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
app.use(require('./src/routes/prestarts-mobile'));
app.use(require('./src/routes/prestart-history'));
app.use(require('./src/routes/vehicle-defects'));
app.use(require('./src/routes/gps'));
app.get('/',(req,res)=>res.redirect('/assets'));
app.use((req,res)=>res.status(404).send('Supervisor365 page not found'));
app.listen(PORT,'0.0.0.0',()=>console.log('Supervisor365 modular master running on '+PORT));

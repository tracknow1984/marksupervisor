const express=require('express');
const router=require('./routes/geofence-prestart-alerts');
const engine=require('./geofence-prestart-alert-engine');

// Mount the geofence compliance API/page without restructuring the master app.
if(!express.__sv365GeofencePrestartJsonPatched){
  express.__sv365GeofencePrestartJsonPatched=true;
  const originalJson=express.json;
  express.json=function(...args){
    const parser=originalJson(...args);
    return function sv365JsonWithGeofencePrestart(req,res,next){
      parser(req,res,err=>err?next(err):router(req,res,next));
    };
  };
}

// This patch is loaded before smart-nav-patch. The smart-nav wrapper therefore runs first and
// passes its completed HTML through here, letting us add the monitoring link and global alert UI.
if(!express.response.__sv365GeofencePrestartUiPatched){
  express.response.__sv365GeofencePrestartUiPatched=true;
  const originalSend=express.response.send;
  const injection=String.raw`
<style id="svGeofencePrestartGlobalStyle">
.gfGlobalToast{position:fixed;right:18px;top:18px;z-index:1900;width:min(430px,calc(100vw - 28px));background:#7a1818;color:#fff;border:1px solid #ff8b8b;border-radius:14px;box-shadow:0 18px 55px #0005;padding:14px 15px;display:none}.gfGlobalToast.show{display:block}.gfGlobalTop{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.gfGlobalTop b{font-size:12px}.gfGlobalTop button{border:0;background:#ffffff16;color:#fff;border-radius:7px;width:27px;height:27px;cursor:pointer}.gfGlobalCopy{font-size:10px;line-height:1.5;color:#ffdede;margin-top:5px}.gfGlobalActions{display:flex;gap:7px;margin-top:10px}.gfGlobalActions a{display:inline-flex;text-decoration:none;padding:7px 9px;border-radius:8px;font-size:10px;font-weight:850;background:#fff;color:#8c1d18}.gfGlobalActions a.secondary{background:#ffffff18;color:#fff;border:1px solid #ffffff33}@media(max-width:800px){.gfGlobalToast{right:14px;top:12px}}
</style>
<script id="svGeofencePrestartGlobalV1">
(()=>{
  function addNav(){const fleet=document.querySelector('[data-smart-group="fleet"] .smartChildren');if(!fleet||fleet.querySelector('a[href="/gps-geofence-alerts"]'))return;const live=fleet.querySelector('a[href="/gps"]'),a=document.createElement('a');a.className='smartChild '+(location.pathname==='/gps-geofence-alerts'?'active':'');a.href='/gps-geofence-alerts';a.setAttribute('data-nav-label','Geofence Alerts');a.innerHTML='<span class="smartChildMain"><span>Geofence Alerts</span></span><span class="smartBadge" data-gf-alert-badge></span>';if(live&&live.nextSibling)fleet.insertBefore(a,live.nextSibling);else fleet.appendChild(a)}
  function toast(){let el=document.getElementById('gfGlobalToast');if(el)return el;el=document.createElement('div');el.id='gfGlobalToast';el.className='gfGlobalToast';el.innerHTML='<div class="gfGlobalTop"><b>Critical GPS Compliance Alert</b><button type="button" aria-label="Dismiss">×</button></div><div class="gfGlobalCopy" id="gfGlobalCopy"></div><div class="gfGlobalActions"><a href="/gps-geofence-alerts">Open Alerts</a><a class="secondary" href="/gps">Live GPS</a></div>';document.body.appendChild(el);el.querySelector('button').onclick=()=>{el.classList.remove('show');sessionStorage.setItem('sv365.gfDismissedAt',String(Date.now()))};return el}
  async function refresh(){addNav();try{const [sr,ar]=await Promise.all([fetch('/api/gps/geofence-prestart/status',{cache:'no-store'}),fetch('/api/gps/geofence-prestart/alerts?openOnly=1',{cache:'no-store'})]),s=await sr.json(),alerts=await ar.json();const n=Number(s.openAlerts)||0,critical=Number(s.critical)||0;document.querySelectorAll('[data-gf-alert-badge]').forEach(b=>{b.textContent=n>99?'99+':String(n);b.classList.toggle('show',n>0);b.classList.toggle('alert',critical>0)});const group=document.querySelector('[data-group-badge="fleet"]');if(group&&n>0){const existing=Number(group.textContent)||0;group.textContent=String(Math.max(existing,n));group.classList.add('show');if(critical)group.classList.add('alert')}if(!critical)return;const latest=(Array.isArray(alerts)?alerts:[])[0];if(!latest)return;const dismissed=Number(sessionStorage.getItem('sv365.gfDismissedAt')||0);if(Date.now()-dismissed<5*60000)return;const el=toast(),copy=document.getElementById('gfGlobalCopy');copy.textContent=(latest.rego||latest.assetName||'Vehicle')+' left '+(latest.geofenceName||'its geofence')+' without a current Passed Pre-Start'+(latest.speedKmh?' · '+Math.round(latest.speedKmh)+' km/h':'')+'.';el.classList.add('show')}catch{}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();setInterval(refresh,30000)
})();
</script>`;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('svSmartNavV1')&&!body.includes('svGeofencePrestartGlobalV1')&&body.includes('</body>'))body=body.replace('</body>',injection+'</body>');
    return originalSend.call(this,body);
  };
}

engine.start();

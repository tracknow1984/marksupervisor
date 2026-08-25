const express=require('express');

if(!express.response.__sv365GpsAutoLinkPatched){
  express.response.__sv365GpsAutoLinkPatched=true;
  const originalSend=express.response.send;
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  let linking=false;

  function score(asset,unit){
    const u=norm(unit?.name),rego=norm(asset?.rego),name=norm(asset?.name),plant=norm(asset?.plantId);
    if(!u)return 0;
    if(rego&&u===rego)return 100;
    if(rego.length>=4&&u.includes(rego))return 95;
    if(name&&u===name)return 90;
    if(plant&&u===plant)return 85;
    if(plant.length>=4&&u.includes(plant))return 80;
    return 0;
  }

  async function autoLink(){
    if(linking)return;
    linking=true;
    try{
      const port=process.env.PORT||3000,base='http://127.0.0.1:'+port;
      const [assetRes,unitRes]=await Promise.all([fetch(base+'/api/assets',{cache:'no-store'}),fetch(base+'/api/gps/wialon/units',{cache:'no-store'})]);
      const assetRows=await assetRes.json(),unitRows=await unitRes.json();
      if(!assetRes.ok||!Array.isArray(assetRows)||!unitRes.ok||!Array.isArray(unitRows))return;
      const used=new Set(assetRows.filter(a=>a.wialonUnitId).map(a=>String(a.wialonUnitId)));
      let linked=0;
      for(const asset of assetRows){
        if(asset.wialonUnitId)continue;
        const candidates=unitRows.filter(u=>!used.has(String(u.id))).map(u=>({u,s:score(asset,u)})).filter(x=>x.s>=80).sort((a,b)=>b.s-a.s);
        if(!candidates.length)continue;
        const best=candidates[0];
        const r=await fetch(base+'/api/gps/link',{method:'POST',headers:{'Content-Type':'application/json','X-Supervisor365-Internal':'gps-auto-link'},body:JSON.stringify({assetId:asset.id,wialonUnitId:String(best.u.id),wialonUnitName:String(best.u.name||'')})});
        if(r.ok){used.add(String(best.u.id));linked++}
      }
      if(linked)console.log('Supervisor365 Wialon auto-linked '+linked+' asset(s) after token connection.');
    }catch(e){console.warn('Supervisor365 Wialon auto-link skipped:',e.message)}finally{linking=false}
  }

  const integrationAssist=String.raw`<script id="svGpsAutoLinkAssist">(()=>{const connect=document.getElementById('connect'),status=document.getElementById('status');if(!connect||!status)return;let pending=false;connect.addEventListener('click',()=>{pending=true},true);new MutationObserver(()=>{if(!pending)return;const text=String(status.textContent||'');if(!/^Connected/i.test(text))return;pending=false;setTimeout(()=>location.reload(),1200)}).observe(status,{childList:true,subtree:true,characterData:true})})();</script>`;

  express.response.send=function(body){
    const req=this.req;
    const tokenSuccess=req&&req.path==='/api/gps/wialon/token'&&req.method==='POST'&&this.statusCode<400&&typeof body==='string'&&/"ok"\s*:\s*true/.test(body);
    if(req&&req.path==='/gps-integration'&&typeof body==='string'&&!body.includes('svGpsAutoLinkAssist')&&body.includes('</body>'))body=body.replace('</body>',integrationAssist+'</body>');
    const result=originalSend.call(this,body);
    if(tokenSuccess){const t=setTimeout(autoLink,150);if(t.unref)t.unref()}
    return result;
  };
}

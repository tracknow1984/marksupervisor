const express=require('express');
const {assets}=require('./store');

const router=express.Router();

// Own the link endpoint ahead of the legacy GPS route so linking is one-to-one.
router.post('/api/gps/link',(req,res)=>{
  try{
    const assetId=String(req.body?.assetId||'').trim();
    const unitId=String(req.body?.wialonUnitId||'').trim();
    const unitName=String(req.body?.wialonUnitName||'').trim();
    const asset=assets.find(a=>String(a.id)===assetId);
    if(!asset)return res.status(404).json({error:'Asset not found'});

    if(unitId){
      const already=assets.find(a=>String(a.id)!==assetId&&String(a.wialonUnitId||'')===unitId);
      if(already){
        return res.status(409).json({
          error:`This Wialon unit is already linked to ${already.rego||already.name||already.id}. Unlink it first before assigning it to another asset.`,
          code:'WIALON_UNIT_ALREADY_LINKED',
          linkedAssetId:already.id
        });
      }
    }

    asset.wialonUnitId=unitId;
    asset.wialonUnitName=unitId?unitName:'';
    res.set('Cache-Control','no-store');
    res.json(asset);
  }catch(e){
    res.status(500).json({error:e.message||'Unable to update GPS link'});
  }
});

if(!express.__sv365GpsLinkAvailabilityJsonPatched){
  express.__sv365GpsLinkAvailabilityJsonPatched=true;
  const originalJson=express.json;
  express.json=function(...args){
    const parser=originalJson(...args);
    return function sv365JsonWithGpsLinkAvailability(req,res,next){
      parser(req,res,err=>err?next(err):router(req,res,next));
    };
  };
}

if(!express.response.__sv365GpsLinkAvailabilityUiPatched){
  express.response.__sv365GpsLinkAvailabilityUiPatched=true;
  const originalSend=express.response.send;
  const injection=String.raw`
<style id="svGpsLinkAvailabilityStyle">
.gpsLinkedPanel{margin-top:14px}.gpsLinkedGrid{display:grid;gap:8px}.gpsLinkedRow{display:grid;grid-template-columns:1.25fr .8fr 1.2fr auto;gap:10px;align-items:center;padding:11px 12px;border:1px solid #e3e9f0;border-radius:10px;background:#fbfcfd}.gpsLinkedRow b{font-size:12px}.gpsLinkedRow .sub{font-size:10px}.gpsLinkedBadge{display:inline-flex;padding:4px 7px;border-radius:999px;background:#e8f7ef;color:#187c49;font-size:9px;font-weight:900}.gpsAvailableEmpty{padding:24px;text-align:center;color:#7c8998}.gpsLinkCount{font-size:10px;color:#7d8998;margin-left:7px}@media(max-width:760px){.gpsLinkedRow{grid-template-columns:1fr}.gpsLinkedRow button{justify-self:start}}
</style>
<script id="svGpsLinkAvailabilityV2">
(()=>{
  if(location.pathname!=='/gps-integration')return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let assetRows=[],filtering=false,observer=null;

  function linkedAssets(){return assetRows.filter(a=>String(a.wialonUnitId||'').trim())}
  function availableAssets(){return assetRows.filter(a=>!String(a.wialonUnitId||'').trim())}
  function usedUnitIds(){return new Set(linkedAssets().map(a=>String(a.wialonUnitId||'').trim()).filter(Boolean))}

  function filterAvailableTable(){
    if(filtering)return;
    const body=document.getElementById('links');if(!body)return;
    filtering=true;
    try{
      const availableIds=new Set(availableAssets().map(a=>String(a.id)));
      const used=usedUnitIds();
      body.querySelectorAll('tr').forEach(tr=>{
        const btn=tr.querySelector('[data-save]');
        if(btn&&!availableIds.has(String(btn.dataset.save))){tr.remove();return}
        const sel=tr.querySelector('select[id^="u_"]');
        if(sel){
          [...sel.options].forEach(opt=>{if(opt.value&&used.has(String(opt.value)))opt.remove()});
        }
      });
      const remaining=body.querySelectorAll('tr [data-save]').length;
      if(!remaining)body.innerHTML='<tr><td colspan="4"><div class="gpsAvailableEmpty">All eligible assets are already linked to GPS units.</div></td></tr>';
    }finally{filtering=false}
  }

  function watchAvailability(){
    const body=document.getElementById('links');if(!body||observer)return;
    let queued=false;
    observer=new MutationObserver(()=>{
      if(filtering||queued)return;
      queued=true;
      setTimeout(()=>{queued=false;filterAvailableTable()},0);
    });
    observer.observe(body,{childList:true,subtree:true});
    filterAvailableTable();
  }

  function ensureLinkedPanel(){
    const table=document.getElementById('links')?.closest('section');if(!table)return null;
    let panel=document.getElementById('gpsLinkedAssetsPanel');
    if(panel)return panel;
    panel=document.createElement('section');panel.id='gpsLinkedAssetsPanel';panel.className='panel gpsLinkedPanel';panel.style.padding='22px';
    panel.innerHTML='<div class="sectionhead" style="margin:0 0 12px"><div><h2 style="margin:0">Linked GPS Assets <span class="gpsLinkCount" id="gpsLinkedCount"></span></h2><div class="sub">Linked assets and Wialon units are removed from the available linking lists until unlinked.</div></div></div><div id="gpsLinkedRows" class="gpsLinkedGrid"></div>';
    table.insertAdjacentElement('afterend',panel);return panel;
  }

  function renderLinked(){
    ensureLinkedPanel();const box=document.getElementById('gpsLinkedRows'),rows=linkedAssets();if(!box)return;
    document.getElementById('gpsLinkedCount').textContent=rows.length?'('+rows.length+')':'';
    box.innerHTML=rows.length?rows.map(a=>'<div class="gpsLinkedRow"><div><b>'+esc(a.name||a.id)+'</b><div class="sub">'+esc(a.type||'Asset')+'</div></div><div><b>'+esc(a.rego||'—')+'</b><div class="sub">Registration</div></div><div><span class="gpsLinkedBadge">LINKED</span><div class="sub" style="margin-top:4px">'+esc(a.wialonUnitName||a.wialonUnitId||'Wialon unit')+'</div></div><button class="secondary" type="button" data-gps-unlink="'+esc(a.id)+'">Unlink</button></div>').join(''):'<div class="gpsAvailableEmpty">No assets are currently linked.</div>';
    box.querySelectorAll('[data-gps-unlink]').forEach(btn=>btn.onclick=async()=>{
      const a=assetRows.find(x=>String(x.id)===String(btn.dataset.gpsUnlink));if(!a)return;
      if(!confirm('Unlink '+(a.rego||a.name||'this asset')+' from its Wialon GPS unit?'))return;
      btn.disabled=true;btn.textContent='Unlinking…';
      try{const r=await nativeFetch('/api/gps/link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assetId:a.id,wialonUnitId:'',wialonUnitName:''})}),d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to unlink asset');location.reload()}catch(e){alert(e.message);btn.disabled=false;btn.textContent='Unlink'}
    });
  }

  async function loadAssets(){
    try{const r=await nativeFetch('/api/assets',{cache:'no-store'}),d=await r.json();if(!r.ok||!Array.isArray(d))return;assetRows=d;watchAvailability();filterAvailableTable();renderLinked()}catch{}
  }

  // Intercept successful linking so the selected asset AND selected Wialon unit are removed
  // immediately, before the page reloads. The MutationObserver keeps them removed after every
  // asynchronous Wialon list refresh as well.
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    const response=await nativeFetch(input,init);
    try{
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(url.includes('/api/gps/link')&&String(init?.method||'').toUpperCase()==='POST'&&response.ok){
        const payload=JSON.parse(init?.body||'{}');
        const unitId=String(payload.wialonUnitId||'').trim();
        const a=assetRows.find(x=>String(x.id)===String(payload.assetId));
        if(a){a.wialonUnitId=unitId;a.wialonUnitName=unitId?String(payload.wialonUnitName||''):''}
        filterAvailableTable();renderLinked();
        if(unitId)setTimeout(()=>location.reload(),350);
      }
    }catch{}
    return response;
  };

  loadAssets();
  const readyTimer=setInterval(()=>{watchAvailability();if(assetRows.length){filterAvailableTable();renderLinked()}},500);
  setTimeout(()=>clearInterval(readyTimer),30000);
})();
</script>`;
  express.response.send=function(body){
    const req=this.req;
    if(req&&req.path==='/gps-integration'&&typeof body==='string'&&!body.includes('svGpsLinkAvailabilityV2')&&body.includes('</body>'))body=body.replace('</body>',injection+'</body>');
    return originalSend.call(this,body);
  };
}

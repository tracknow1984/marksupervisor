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
<script id="svGpsLinkAvailabilityV1">
(()=>{
  if(location.pathname!=='/gps-integration')return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let assetRows=[];

  function linkedAssets(){return assetRows.filter(a=>String(a.wialonUnitId||'').trim())}
  function availableAssets(){return assetRows.filter(a=>!String(a.wialonUnitId||'').trim())}

  function filterAvailableTable(){
    const body=document.getElementById('links');if(!body)return;
    const availableIds=new Set(availableAssets().map(a=>String(a.id)));
    body.querySelectorAll('tr').forEach(tr=>{
      const btn=tr.querySelector('[data-save]');
      if(btn&&!availableIds.has(String(btn.dataset.save)))tr.remove();
    });
    const remaining=body.querySelectorAll('tr [data-save]').length;
    if(!remaining)body.innerHTML='<tr><td colspan="4"><div class="gpsAvailableEmpty">All eligible assets are already linked to GPS units.</div></td></tr>';

    // Do not offer a Wialon unit already linked to another asset.
    const used=new Set(linkedAssets().map(a=>String(a.wialonUnitId)));
    body.querySelectorAll('select[id^="u_"]').forEach(sel=>{
      [...sel.options].forEach(opt=>{if(opt.value&&used.has(String(opt.value)))opt.remove()});
    });
  }

  function ensureLinkedPanel(){
    const table=document.getElementById('links')?.closest('section');if(!table)return null;
    let panel=document.getElementById('gpsLinkedAssetsPanel');
    if(panel)return panel;
    panel=document.createElement('section');panel.id='gpsLinkedAssetsPanel';panel.className='panel gpsLinkedPanel';panel.style.padding='22px';
    panel.innerHTML='<div class="sectionhead" style="margin:0 0 12px"><div><h2 style="margin:0">Linked GPS Assets <span class="gpsLinkCount" id="gpsLinkedCount"></span></h2><div class="sub">Already-linked assets are removed from the available linking list.</div></div></div><div id="gpsLinkedRows" class="gpsLinkedGrid"></div>';
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
      try{const r=await window.fetch('/api/gps/link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assetId:a.id,wialonUnitId:'',wialonUnitName:''})}),d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to unlink asset');location.reload()}catch(e){alert(e.message);btn.disabled=false;btn.textContent='Unlink'}
    });
  }

  async function loadAssets(){
    try{const r=await window.fetch('/api/assets',{cache:'no-store'}),d=await r.json();if(!r.ok||!Array.isArray(d))return;assetRows=d;filterAvailableTable();renderLinked()}catch{}
  }

  // Existing GPS Integration code already handles the Save Link button. Refresh the page
  // after a successful link so the asset immediately leaves the available list.
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    const response=await nativeFetch(input,init);
    try{
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(url.includes('/api/gps/link')&&String(init?.method||'').toUpperCase()==='POST'&&response.ok){
        const payload=JSON.parse(init?.body||'{}');
        if(String(payload.wialonUnitId||'').trim())setTimeout(()=>location.reload(),350);
      }
    }catch{}
    return response;
  };

  // The legacy page builds its rows after loading Wialon units, so re-apply the availability
  // filter briefly while that asynchronous render completes.
  loadAssets();let tries=0;const timer=setInterval(()=>{tries++;if(assetRows.length){filterAvailableTable();renderLinked()}if(tries>30)clearInterval(timer)},250);
})();
</script>`;
  express.response.send=function(body){
    const req=this.req;
    if(req&&req.path==='/gps-integration'&&typeof body==='string'&&!body.includes('svGpsLinkAvailabilityV1')&&body.includes('</body>'))body=body.replace('</body>',injection+'</body>');
    return originalSend.call(this,body);
  };
}

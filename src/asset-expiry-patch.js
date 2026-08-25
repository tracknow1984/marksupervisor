const express=require('express');

if(!express.response.__sv365AssetExpiryPatched){
  express.response.__sv365AssetExpiryPatched=true;
  const originalSend=express.response.send;

  const injection=String.raw`
<style id="svAssetExpiryStyle">
.assetExpiryCell{white-space:nowrap}.expiryLights{display:inline-flex;align-items:center;gap:5px;padding:7px 9px;border:1px solid #dfe5ec;background:#fff;border-radius:999px;cursor:pointer;transition:.15s ease;box-shadow:0 1px 2px rgba(15,23,42,.03)}.expiryLights:hover{border-color:#9fc0e8;background:#f8fbff;transform:translateY(-1px);box-shadow:0 5px 14px rgba(15,23,42,.08)}.expiryLight{width:10px;height:10px;border-radius:50%;background:#d9e0e8;box-shadow:inset 0 0 0 1px rgba(15,23,42,.06);transition:.15s ease}.expiryLight.red.active{background:#dc3f45;box-shadow:0 0 0 3px rgba(220,63,69,.12),0 0 9px rgba(220,63,69,.28)}.expiryLight.yellow.active{background:#e5a324;box-shadow:0 0 0 3px rgba(229,163,36,.14),0 0 9px rgba(229,163,36,.25)}.expiryLight.green.active{background:#22a06b;box-shadow:0 0 0 3px rgba(34,160,107,.12),0 0 9px rgba(34,160,107,.24)}
.expiryModal{display:none;position:fixed;inset:0;background:rgba(15,23,42,.62);z-index:1250;align-items:center;justify-content:center;padding:20px}.expiryModal.open{display:flex}.expiryBox{width:min(620px,96vw);max-height:88vh;overflow:auto;background:#fff;border:1px solid #e3e8ef;border-radius:16px;box-shadow:0 30px 90px rgba(0,0,0,.34)}.expiryHead{padding:19px 21px;border-bottom:1px solid #e7ecf2;display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.expiryHead h2{margin:0 0 4px;font-size:20px}.expiryClose{border:0;background:none;color:#697789;font-size:26px;line-height:1;cursor:pointer}.expiryBody{padding:19px 21px 22px}.expiryOverall{display:flex;align-items:center;gap:11px;padding:13px 14px;border:1px solid #e3e8ef;border-radius:11px;background:#fafbfd;margin-bottom:14px}.expiryOverallDot{width:14px;height:14px;border-radius:50%;flex:0 0 14px}.expiryOverallDot.red{background:#dc3f45;box-shadow:0 0 0 4px rgba(220,63,69,.10)}.expiryOverallDot.yellow{background:#e5a324;box-shadow:0 0 0 4px rgba(229,163,36,.11)}.expiryOverallDot.green{background:#22a06b;box-shadow:0 0 0 4px rgba(34,160,107,.10)}.expiryOverall b{display:block;font-size:13px}.expiryOverall span{display:block;font-size:11px;color:#7c8898;margin-top:2px}.expiryItems{display:grid;gap:8px}.expiryItem{display:grid;grid-template-columns:12px 1fr auto;gap:10px;align-items:center;border:1px solid #e6ebf0;border-radius:10px;padding:11px 12px}.expiryItemDot{width:10px;height:10px;border-radius:50%;background:#cbd5e1}.expiryItemDot.red{background:#dc3f45}.expiryItemDot.yellow{background:#e5a324}.expiryItemDot.green{background:#22a06b}.expiryItemDot.grey{background:#cbd5e1}.expiryItemTitle{font-size:12px;font-weight:800;color:#344054}.expiryItemSub{font-size:10px;color:#8995a5;margin-top:3px}.expiryItemState{font-size:10px;font-weight:850;border-radius:999px;padding:5px 8px;white-space:nowrap}.expiryItemState.red{background:#ffe9e9;color:#b42318}.expiryItemState.yellow{background:#fff3da;color:#9a650d}.expiryItemState.green{background:#eaf8f0;color:#17884c}.expiryItemState.grey{background:#eef2f6;color:#667085}.expiryLegend{display:flex;gap:13px;flex-wrap:wrap;margin-top:15px;padding-top:13px;border-top:1px solid #edf1f5;color:#7d8998;font-size:10px}.expiryLegend span{display:inline-flex;align-items:center;gap:5px}.expiryLegend i{width:8px;height:8px;border-radius:50%;display:inline-block}.expiryLegend .r{background:#dc3f45}.expiryLegend .y{background:#e5a324}.expiryLegend .g{background:#22a06b}@media(max-width:700px){.expiryItem{grid-template-columns:12px 1fr}.expiryItemState{grid-column:2;justify-self:start}.assetExpiryCell{min-width:72px}}
</style>
<script id="svAssetExpiryV1">
(()=>{
  const rows=document.getElementById('rows');
  if(!rows||rows.dataset.expiryReady==='1')return;
  rows.dataset.expiryReady='1';
  const WARNING_DAYS=30;
  let assets=[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const expiryFields=[
    {key:'registrationExpiry',label:'Registration Expiry'},
    {key:'insuranceExpiry',label:'Insurance Expiry'},
    {key:'coiDueDate',label:'Certificate of Inspection (COI)'}
  ];
  function todayStart(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate()).getTime()}
  function parseDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return null;const d=new Date(String(value)+'T00:00:00');return Number.isFinite(d.getTime())?d:null}
  function daysTo(value){const d=parseDate(value);if(!d)return null;return Math.round((d.getTime()-todayStart())/86400000)}
  function itemState(value){const days=daysTo(value);if(days===null)return{tone:'grey',days:null,text:'Not recorded'};if(days<0)return{tone:'red',days,text:Math.abs(days)+' day'+(Math.abs(days)===1?'':'s')+' overdue'};if(days===0)return{tone:'yellow',days,text:'Expires today'};if(days<=WARNING_DAYS)return{tone:'yellow',days,text:'Expires in '+days+' day'+(days===1?'':'s')};return{tone:'green',days,text:'Current · '+days+' days remaining'}}
  function health(asset){const items=expiryFields.map(f=>({...f,value:asset[f.key]||'',state:itemState(asset[f.key])}));let tone='green';if(items.some(x=>x.state.tone==='red'))tone='red';else if(items.some(x=>x.state.tone==='yellow'))tone='yellow';const tracked=items.filter(x=>x.state.tone!=='grey').length;return{tone,items,tracked}}
  function labelFor(tone){return tone==='red'?'Expired item requires attention':tone==='yellow'?'Expiry approaching':'All recorded expiries are current'}
  function ensureHeader(){const tr=rows.closest('table')?.querySelector('thead tr');if(!tr||tr.querySelector('[data-expiry-head]'))return;const th=document.createElement('th');th.dataset.expiryHead='1';th.textContent='Expiry';const last=tr.lastElementChild;tr.insertBefore(th,last||null)}
  function lightButton(asset){const h=health(asset);return '<button type="button" class="expiryLights" data-expiry-id="'+esc(asset.id)+'" title="'+esc(labelFor(h.tone))+'" aria-label="Expiry health for '+esc(asset.rego||asset.name)+'"><span class="expiryLight red '+(h.tone==='red'?'active':'')+'"></span><span class="expiryLight yellow '+(h.tone==='yellow'?'active':'')+'"></span><span class="expiryLight green '+(h.tone==='green'?'active':'')+'"></span></button>'}
  function decorate(){ensureHeader();const byId=new Map(assets.map(a=>[String(a.id),a]));rows.querySelectorAll('tr').forEach(tr=>{const view=tr.querySelector('[data-view]');if(!view)return;const asset=byId.get(String(view.dataset.view));if(!asset)return;let cell=tr.querySelector('.assetExpiryCell');if(!cell){cell=document.createElement('td');cell.className='assetExpiryCell';tr.insertBefore(cell,tr.lastElementChild||null)}const html=lightButton(asset);if(cell.innerHTML!==html)cell.innerHTML=html});rows.querySelectorAll('[data-expiry-id]').forEach(b=>b.onclick=e=>{e.stopPropagation();openExpiry(b.dataset.expiryId)})}
  const modal=document.createElement('div');modal.className='expiryModal';modal.id='expiryModal';modal.innerHTML='<div class="expiryBox"><div class="expiryHead"><div><h2 id="expiryTitle">Asset Expiry Health</h2><div class="sub" id="expirySub"></div></div><button type="button" class="expiryClose" id="expiryClose" aria-label="Close">×</button></div><div class="expiryBody" id="expiryBody"></div></div>';document.body.appendChild(modal);
  function formatDate(value){const d=parseDate(value);return d?d.toLocaleDateString('en-AU',{day:'2-digit',month:'short',year:'numeric'}):'No date recorded'}
  function openExpiry(id){const asset=assets.find(a=>String(a.id)===String(id));if(!asset)return;const h=health(asset);document.getElementById('expiryTitle').textContent='Asset Expiry Health';document.getElementById('expirySub').textContent=(asset.rego||asset.id)+' · '+(asset.name||asset.type||'Asset');const overallText=h.tone==='red'?'One or more compliance dates have expired.':h.tone==='yellow'?'One or more compliance dates expire within '+WARNING_DAYS+' days.':h.tracked?'All recorded compliance dates are outside the '+WARNING_DAYS+' day warning window.':'No expiry dates are currently recorded for this asset.';document.getElementById('expiryBody').innerHTML='<div class="expiryOverall"><span class="expiryOverallDot '+h.tone+'"></span><div><b>'+esc(labelFor(h.tone))+'</b><span>'+esc(overallText)+'</span></div></div><div class="expiryItems">'+h.items.map(x=>'<div class="expiryItem"><span class="expiryItemDot '+x.state.tone+'"></span><div><div class="expiryItemTitle">'+esc(x.label)+'</div><div class="expiryItemSub">'+esc(formatDate(x.value))+'</div></div><span class="expiryItemState '+x.state.tone+'">'+esc(x.state.text)+'</span></div>').join('')+'</div><div class="expiryLegend"><span><i class="r"></i> Red = expired</span><span><i class="y"></i> Yellow = due within '+WARNING_DAYS+' days</span><span><i class="g"></i> Green = current</span></div>';modal.classList.add('open')}
  document.getElementById('expiryClose').onclick=()=>modal.classList.remove('open');modal.onclick=e=>{if(e.target===modal)modal.classList.remove('open')};
  let decorateTimer=0;new MutationObserver(()=>{clearTimeout(decorateTimer);decorateTimer=setTimeout(decorate,20)}).observe(rows,{childList:true,subtree:true});
  async function loadAssets(){try{const r=await fetch('/api/assets',{cache:'no-store'}),d=await r.json();if(r.ok&&Array.isArray(d)){assets=d;decorate()}}catch(e){console.warn('Asset expiry health failed',e)}}
  loadAssets();setInterval(loadAssets,60000);
})();
</script>`;

  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('id="rows"')&&body.includes('id="addAssetBtn"')&&!body.includes('svAssetExpiryV1')){
      if(body.includes('</body>'))body=body.replace('</body>',injection+'</body>');
    }
    return originalSend.call(this,body);
  };
}

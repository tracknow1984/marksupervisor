const express=require('express');

// Futuristic, actionable summary deck for the Assets register.
if(!express.response.__sv365AssetsSummaryFuturePatched){
  express.response.__sv365AssetsSummaryFuturePatched=true;
  const originalSend=express.response.send;

  const style=String.raw`<style id="sv365AssetsSummaryFutureStyle">
.assetSummaryDeck{position:relative;isolation:isolate;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 16px;padding:8px;border:1px solid rgba(76,145,190,.22);border-radius:16px;background:linear-gradient(180deg,#0c1a29,#08131f);box-shadow:0 14px 34px rgba(7,17,28,.12),inset 0 1px rgba(255,255,255,.035);overflow:hidden}
.assetSummaryDeck:before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(90deg,transparent 0,rgba(53,196,235,.045) 1px,transparent 1px),linear-gradient(0deg,transparent 0,rgba(53,196,235,.03) 1px,transparent 1px),radial-gradient(circle at 50% -70%,rgba(55,199,242,.18),transparent 48%);background-size:46px 46px,46px 46px,100% 100%}
.assetSummaryDeck:after{content:"";position:absolute;left:8%;right:8%;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(72,213,247,.78),transparent);box-shadow:0 0 12px rgba(53,203,241,.35)}
.assetSummaryCard{position:relative;min-height:92px;padding:11px 12px 10px 14px;border:1px solid rgba(127,160,190,.15);border-radius:11px;background:linear-gradient(145deg,rgba(23,42,60,.9),rgba(11,25,39,.93));text-decoration:none;color:#edf7fc;overflow:hidden;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease}
.assetSummaryCard:before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:2px;border-radius:0 2px 2px 0;background:linear-gradient(#4bd7fa,#247bc9);box-shadow:0 0 9px rgba(55,203,242,.3)}
.assetSummaryCard:hover,.assetSummaryCard.selected{transform:translateY(-2px);border-color:rgba(75,207,243,.38);background:linear-gradient(145deg,rgba(27,51,72,.98),rgba(12,30,45,.98));box-shadow:0 9px 22px rgba(3,12,22,.22),0 0 18px rgba(49,193,232,.07)}
.assetSummaryCard.activeTone:before{background:linear-gradient(#69e6a2,#27945d);box-shadow:0 0 9px rgba(52,197,113,.28)}
.assetSummaryCard.serviceTone:before{background:linear-gradient(#ffd46d,#cb8612);box-shadow:0 0 9px rgba(221,155,37,.28)}
.assetSummaryCard.defectTone:before{background:linear-gradient(#ff7d7d,#bd3535);box-shadow:0 0 9px rgba(234,75,75,.3)}
.assetSummaryTop{display:flex;align-items:center;justify-content:space-between;gap:8px}.assetSummaryLabel{font-size:8px;line-height:1.2;letter-spacing:.85px;text-transform:uppercase;font-weight:900;color:#8ea4b8}.assetSummaryIcon{width:29px;height:29px;flex:0 0 29px;border-radius:8px;display:grid;place-items:center;color:#50d1f3;background:rgba(42,177,220,.1);border:1px solid rgba(75,207,243,.13)}.assetSummaryIcon svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.activeTone .assetSummaryIcon{color:#6ce5a4;background:rgba(37,160,94,.1);border-color:rgba(72,198,126,.15)}.serviceTone .assetSummaryIcon{color:#ffcd68;background:rgba(202,139,26,.1);border-color:rgba(231,170,55,.15)}.defectTone .assetSummaryIcon{color:#ff8989;background:rgba(207,62,62,.1);border-color:rgba(232,92,92,.15)}
.assetSummaryValue{display:block;margin-top:7px;font-size:24px;line-height:1;font-weight:900;letter-spacing:-.7px;color:#f6fbff}.assetSummaryMeta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;font-size:8px;color:#71879b}.assetSummaryMeta span:last-child{color:#57d4f3;font-weight:900}.activeTone .assetSummaryMeta span:last-child{color:#72e2aa}.serviceTone .assetSummaryMeta span:last-child{color:#ffd073}.defectTone .assetSummaryMeta span:last-child{color:#ff9696}
.assetSummaryBanner{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-6px 0 14px;padding:10px 12px;border:1px solid #d8e6f1;border-radius:10px;background:linear-gradient(90deg,#f5faff,#fff);font-size:11px;color:#556579}.assetSummaryBanner b{color:#203248}.assetSummaryBanner a{font-size:10px;font-weight:900;color:#1768c5;text-decoration:none;white-space:nowrap}
.assetIssueGo{display:inline-flex!important;align-items:center;justify-content:center;min-height:36px;padding:0 10px!important;border-radius:9px!important;background:#eef8fd!important;border:1px solid #b8def0!important;color:#1774a6!important;font-size:10px!important;font-weight:850!important;text-decoration:none!important}.assetIssueGo:hover{background:#def3fb!important}
@media(max-width:900px){.assetSummaryDeck{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.assetSummaryDeck{grid-template-columns:1fr 1fr;gap:6px;padding:7px}.assetSummaryCard{min-height:88px;padding:10px}.assetSummaryValue{font-size:22px}.assetSummaryMeta{font-size:7px}.assetSummaryBanner{align-items:flex-start;flex-direction:column}}
</style>`;

  const deck=String.raw`<section class="assetSummaryDeck" aria-label="Asset summary">
<a class="assetSummaryCard" data-summary="all" href="/assets"><div class="assetSummaryTop"><span class="assetSummaryLabel">Total Assets</span><span class="assetSummaryIcon"><svg viewBox="0 0 24 24"><path d="M3 6h11v11H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg></span></div><strong class="assetSummaryValue" id="total">—</strong><div class="assetSummaryMeta"><span>Complete fleet register</span><span>View all →</span></div></a>
<a class="assetSummaryCard activeTone" data-summary="active" href="/assets?summary=active"><div class="assetSummaryTop"><span class="assetSummaryLabel">Active</span><span class="assetSummaryIcon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg></span></div><strong class="assetSummaryValue" id="active">—</strong><div class="assetSummaryMeta"><span>In-service assets</span><span>Filter →</span></div></a>
<a class="assetSummaryCard serviceTone" data-summary="serviceDue" href="/assets?summary=serviceDue"><div class="assetSummaryTop"><span class="assetSummaryLabel">Due for Service</span><span class="assetSummaryIcon"><svg viewBox="0 0 24 24"><path d="M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-4-4z"/></svg></span></div><strong class="assetSummaryValue" id="serviceDue">—</strong><div class="assetSummaryMeta"><span>Assets needing attention</span><span>Resolve →</span></div></a>
<a class="assetSummaryCard defectTone" data-summary="defects" href="/vehicle-defects?from=assets-summary"><div class="assetSummaryTop"><span class="assetSummaryLabel">Open Defects</span><span class="assetSummaryIcon"><svg viewBox="0 0 24 24"><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".8"/></svg></span></div><strong class="assetSummaryValue" id="openDefects">—</strong><div class="assetSummaryMeta"><span>Unresolved defects</span><span>Resolve →</span></div></a>
</section>`;

  const assetsScript=String.raw`<script id="sv365AssetsSummaryFutureScript">(()=>{
const deck=document.querySelector('.assetSummaryDeck'),rows=document.getElementById('rows');if(!deck||!rows)return;
const params=new URLSearchParams(location.search),mode=params.get('summary')||'all';let assetData=[];
deck.querySelectorAll('[data-summary]').forEach(a=>a.classList.toggle('selected',a.dataset.summary===mode));
const toolbar=document.querySelector('.toolbar');let banner=null;
function ensureBanner(){if(!['active','serviceDue'].includes(mode))return;banner=document.getElementById('assetSummaryBanner');if(!banner){banner=document.createElement('div');banner.id='assetSummaryBanner';banner.className='assetSummaryBanner';deck.insertAdjacentElement('afterend',banner)}}
function selectedAssets(){if(mode==='active')return assetData.filter(a=>String(a.status)==='In Service');if(mode==='serviceDue')return assetData.filter(a=>!!a.serviceDue);return assetData}
function apply(){if(!assetData.length)return;const allowed=new Set(selectedAssets().map(a=>String(a.id))),trs=[...rows.querySelectorAll('tr')];let visible=0;trs.forEach(tr=>{const trigger=tr.querySelector('[data-view]'),id=trigger&&String(trigger.dataset.view||'');if(!id)return;const show=mode==='all'||allowed.has(id);tr.style.display=show?'':'none';if(show)visible++;if(mode==='serviceDue'&&show){const actions=tr.querySelector('.actionlinks');if(actions&&!actions.querySelector('.assetIssueGo')){const link=document.createElement('a');link.className='assetIssueGo';link.href='/service?asset='+encodeURIComponent(id)+'&from=assets-summary';link.textContent='Schedule';link.title='Schedule service for this asset';actions.appendChild(link)}}});if(banner){if(mode==='active')banner.innerHTML='<span><b>'+visible+' active asset'+(visible===1?'':'s')+'</b> shown — only assets currently marked In Service.</span><a href="/assets">Clear filter →</a>';else banner.innerHTML='<span><b>'+visible+' asset'+(visible===1?'':'s')+' due for service</b> — choose Schedule beside an asset to create its service booking.</span><a href="/service">Open Service Schedule →</a>'}}
async function loadAssetData(){try{const r=await fetch('/api/assets',{cache:'no-store'}),d=await r.json();assetData=Array.isArray(d)?d:[];ensureBanner();apply()}catch{}}
async function refreshDefects(){try{const r=await fetch('/api/vehicle-defects',{cache:'no-store'}),d=await r.json();if(r.ok&&Array.isArray(d)){const n=d.filter(x=>!['RESOLVED','CLOSED'].includes(String(x.status||'').toUpperCase())).length,el=document.getElementById('openDefects');if(el)el.textContent=n}}catch{}}
new MutationObserver(()=>apply()).observe(rows,{childList:true,subtree:true});
const search=document.getElementById('search'),type=document.getElementById('typeFilter');if(search)search.addEventListener('input',()=>setTimeout(apply,0));if(type)type.addEventListener('change',()=>setTimeout(apply,0));
loadAssetData();refreshDefects();
})();</script>`;

  const serviceScript=String.raw`<script id="sv365AssetServicePrefill">(()=>{const p=new URLSearchParams(location.search),id=p.get('asset');if(!id)return;let tries=0;const timer=setInterval(()=>{tries++;const select=document.getElementById('vehicle'),form=document.querySelector('.serviceForm');if(select&&[...select.options].some(o=>String(o.value)===String(id))){clearInterval(timer);select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));if(form){form.style.boxShadow='0 0 0 3px rgba(48,179,224,.14),0 12px 30px rgba(18,70,102,.08)';form.style.borderColor='#8fcde8';form.scrollIntoView({behavior:'smooth',block:'start'})}const type=form&&form.querySelector('[name="serviceType"]');if(type)setTimeout(()=>type.focus(),350)}else if(tries>35)clearInterval(timer)},100)})();</script>`;

  const defectsScript=String.raw`<script id="sv365AssetsDefectJump">(()=>{const p=new URLSearchParams(location.search);if(p.get('from')!=='assets-summary')return;const panel=document.querySelector('.panel'),title=document.querySelector('.title');if(title){const n=document.createElement('div');n.style.cssText='margin:0 0 14px;padding:10px 12px;border:1px solid #f0c4c4;background:#fff6f6;border-radius:10px;color:#8d2d2d;font-size:11px;font-weight:750';n.textContent='Asset Summary: showing unresolved defects ready for action.';title.insertAdjacentElement('afterend',n)}setTimeout(()=>panel&&panel.scrollIntoView({behavior:'smooth',block:'start'}),120)})();</script>`;

  express.response.send=function(body){
    const req=this.req,path=req&&req.path;
    if(typeof body==='string'&&path==='/assets'&&!body.includes('sv365AssetsSummaryFutureStyle')){
      body=body.replace(/<section class="cards">[\s\S]*?<\/section>/,deck);
      if(body.includes('</body>'))body=body.replace('</body>',style+assetsScript+'</body>');
    }else if(typeof body==='string'&&path==='/service'&&!body.includes('sv365AssetServicePrefill')&&body.includes('</body>')){
      body=body.replace('</body>',serviceScript+'</body>');
    }else if(typeof body==='string'&&path==='/vehicle-defects'&&!body.includes('sv365AssetsDefectJump')&&body.includes('</body>')){
      body=body.replace('</body>',defectsScript+'</body>');
    }
    return originalSend.call(this,body);
  };
}

const express=require('express');
const router=express.Router();
const {page}=require('../layout');
const modules=require('../module-store');
const accounts=require('../company-account-store');

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function cookie(req,name){const raw=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));return raw?decodeURIComponent(raw.slice(name.length+1)):''}
function context(req){return accounts.getSession(cookie(req,'sv365_session'))}
function companyKey(req){return context(req)?.company?.id||'default'}
function canManage(req){const ctx=context(req);return !ctx||['Company Admin','Owner'].includes(ctx.user?.role)}
function icon(id){
  const paths={
    assets:'<path d="M4 16V9a2 2 0 0 1 2-2h10l4 4v5M3 16h18v3H3z"/><circle cx="7" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
    employees:'<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
    'live-gps':'<path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/>',
    prestarts:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5h6V6H9zM8 11l2 2 5-5M8 17h8"/>',
    maintenance:'<path d="M5 7h14v12H5zM8 4v6M16 4v6M8 14h8"/>',
    incidents:'<path d="M12 3 3 20h18L12 3Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".7" fill="currentColor"/>',
    compliance:'<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/>',
    ewd:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2M7 3 5 5M17 3l2 2"/>',
    reports:'<path d="M5 20V10M10 20V4M15 20v-7M20 20V7"/>',
    'geofence-alerts':'<path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><path d="M12 7v5M12 15h.01"/>'
  };
  return'<svg viewBox="0 0 24 24" aria-hidden="true">'+(paths[id]||paths.reports)+'</svg>';
}
function card(item){
  const action=item.base?'<span class="included">Included</span>':item.enabled?'<button type="button" class="removeModule" data-remove="'+esc(item.id)+'">Remove Module</button>':'<button type="button" class="addModule" data-add="'+esc(item.id)+'">＋ Add Module</button>';
  const dependency=item.requires?.length?'<div class="dependency">Also activates: '+item.requires.map(id=>esc(modules.CATALOG.find(x=>x.id===id)?.name||id)).join(', ')+'</div>':'';
  return'<article class="moduleCard '+(item.enabled?'enabled':'')+'" data-module="'+esc(item.id)+'"><div class="moduleTop"><div class="moduleIcon">'+icon(item.id)+'</div><div class="moduleStatus">'+(item.base?'Core':item.enabled?'Active':'Available')+'</div></div><div class="moduleCategory">'+esc(item.category)+'</div><h2>'+esc(item.name)+'</h2><p>'+esc(item.description)+'</p><ul>'+item.features.map(x=>'<li>✓ '+esc(x)+'</li>').join('')+'</ul>'+dependency+'<div class="moduleAction">'+action+'</div></article>';
}

router.get('/api/modules',(req,res)=>{res.set('Cache-Control','no-store');res.json(modules.snapshot(companyKey(req)))});
router.post('/api/modules/:id/add',(req,res)=>{if(!canManage(req))return res.status(403).json({error:'Company administrator access required'});try{res.set('Cache-Control','no-store');res.json(modules.setEnabled(companyKey(req),req.params.id,true))}catch(e){res.status(400).json({error:e.message})}});
router.post('/api/modules/:id/remove',(req,res)=>{if(!canManage(req))return res.status(403).json({error:'Company administrator access required'});try{res.set('Cache-Control','no-store');res.json(modules.setEnabled(companyKey(req),req.params.id,false))}catch(e){res.status(400).json({error:e.message})}});

router.get('/modules',(req,res)=>{
  const data=modules.snapshot(companyKey(req));
  const active=data.items.filter(x=>x.enabled).length;
  const optional=data.items.filter(x=>!x.base).length;
  res.send(page('modules','Modules Store',`
<style>
.moduleHero{background:linear-gradient(135deg,#0d1826,#13263a 58%,#113148);border-radius:18px;padding:25px 27px;color:#fff;margin-bottom:18px;display:flex;justify-content:space-between;gap:22px;align-items:center;box-shadow:0 16px 38px rgba(15,31,49,.13)}.moduleEyebrow{font-size:10px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:#55cef5}.moduleHero h1{margin:6px 0 7px;font-size:28px}.moduleHero p{margin:0;color:#9fb1c3;max-width:720px;font-size:13px;line-height:1.55}.moduleCounts{display:grid;grid-template-columns:repeat(2,minmax(105px,1fr));gap:9px;min-width:260px}.moduleCount{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.045);padding:12px;border-radius:12px}.moduleCount span{display:block;color:#7f93a7;font-size:9px;text-transform:uppercase;font-weight:850}.moduleCount b{display:block;font-size:22px;margin-top:3px}.moduleNote{border:1px solid #cfe2f2;background:#f4faff;color:#456078;border-radius:12px;padding:13px 15px;margin-bottom:18px;font-size:12px;line-height:1.5}.moduleGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.moduleCard{background:#fff;border:1px solid #e1e7ee;border-radius:15px;padding:18px;display:flex;flex-direction:column;min-height:350px;box-shadow:0 8px 22px rgba(23,42,64,.035);transition:.16s ease}.moduleCard:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(23,42,64,.08)}.moduleCard.enabled{border-color:#a9d8eb;box-shadow:inset 0 3px #34bde9,0 9px 24px rgba(23,42,64,.05)}.moduleTop{display:flex;align-items:flex-start;justify-content:space-between}.moduleIcon{width:45px;height:45px;border-radius:13px;display:grid;place-items:center;background:#eef7fb;color:#1688b7}.moduleIcon svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.moduleStatus{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.7px;color:#728195;background:#f4f6f8;border-radius:999px;padding:5px 8px}.enabled .moduleStatus{color:#13759a;background:#e6f7fd}.moduleCategory{font-size:9px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#258eb8;margin-top:16px}.moduleCard h2{margin:5px 0 7px;font-size:17px}.moduleCard p{font-size:12px;line-height:1.5;color:#6e7b8c;margin:0 0 12px}.moduleCard ul{list-style:none;padding:0;margin:0 0 12px;display:grid;gap:6px}.moduleCard li{font-size:11px;color:#4b5a6d}.dependency{font-size:10px;color:#8a6516;background:#fff8e6;border:1px solid #f0ddad;border-radius:8px;padding:7px 8px;margin-top:2px}.moduleAction{margin-top:auto;padding-top:14px}.moduleAction button,.included{width:100%;height:39px;border-radius:9px;font-weight:850;font-size:11px;display:flex;align-items:center;justify-content:center}.addModule{border:0;background:#167eb7;color:#fff;cursor:pointer}.addModule:hover{background:#116b9d}.removeModule{border:1px solid #d8e0e8;background:#fff;color:#59697c;cursor:pointer}.removeModule:hover{background:#f7f9fb}.included{border:1px solid #bee5cf;background:#eefaf3;color:#17884c}.moduleAction button[disabled]{opacity:.6;cursor:wait}@media(max-width:1100px){.moduleGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.moduleHero{align-items:flex-start;flex-direction:column}.moduleCounts{min-width:0;width:100%}.moduleGrid{grid-template-columns:1fr}}
</style>
<section class="moduleHero"><div><div class="moduleEyebrow">Internal Module Store</div><h1>Build the system your operation needs</h1><p>Every account starts with Assets, Employees and Live GPS. Add operational modules when the client needs them and they will appear in the Supervisor365 navigation immediately.</p></div><div class="moduleCounts"><div class="moduleCount"><span>Active Modules</span><b>${active}</b></div><div class="moduleCount"><span>Available Add-ons</span><b>${optional}</b></div></div></section>
<div class="moduleNote"><b>Module activation is live.</b> This first version controls module activation and navigation inside Supervisor365. Pricing, approval rules and subscription billing can be connected as the next commercial layer.</div>
<section class="moduleGrid">${data.items.map(card).join('')}</section>
<script>(()=>{async function change(id,action,button){const original=button.textContent;button.disabled=true;button.textContent=action==='add'?'Adding…':'Removing…';try{const r=await fetch('/api/modules/'+encodeURIComponent(id)+'/'+action,{method:'POST'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to update modules');if(window.sv365ApplyModules)window.sv365ApplyModules(d);location.reload()}catch(e){alert(e.message);button.disabled=false;button.textContent=original}}document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>change(b.dataset.add,'add',b));document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(confirm('Remove this module from the company navigation?'))change(b.dataset.remove,'remove',b)})})();</script>
`));
});

module.exports=router;

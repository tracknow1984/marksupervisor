const express=require('express');
const router=express.Router();
const {page}=require('../layout');
const {assets,vehicleDefects,prestartHistory}=require('../store');

const active=d=>!['RESOLVED','CLOSED'].includes(String(d.status||'').toUpperCase());
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const priorityFor=label=>{const s=String(label||'').toLowerCase();if(/brake|steering|tyre|wheel|seat belt|king pin|tow eye|coupling|breakaway|air system|chassis crack/.test(s))return 'HIGH';if(/light|warning|wiper|mirror|leak|suspension|bearing|exhaust/.test(s))return 'MEDIUM';return 'LOW'};

function recalc(assetId){
  const a=assets.find(x=>String(x.id)===String(assetId));
  if(a)a.openDefects=vehicleDefects.filter(d=>String(d.assetId)===String(assetId)&&active(d)).length;
}

// Safety-net synchroniser: every failed Pre-Start item must have one defect record.
function syncDefectsFromPrestarts(){
  let added=0;
  for(const ps of prestartHistory){
    const failed=(ps.results||[]).filter(r=>String(r.value||'').toLowerCase()==='fail');
    for(const fail of failed){
      const exists=vehicleDefects.some(d=>String(d.prestartId)===String(ps.id)&&String(d.prestartItemId)===String(fail.itemId));
      if(exists)continue;
      const now=ps.completedAt||new Date().toISOString();
      vehicleDefects.push({
        id:'DEF-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),
        assetId:ps.assetId,assetName:ps.assetName,assetType:ps.assetType,rego:ps.rego,
        prestartId:ps.id,prestartItemId:fail.itemId||null,defect:fail.label||'Pre-Start defect',
        reportedAt:now,reportedBy:ps.inspector||'Current User',reading:ps.reading||0,
        location:ps.address||ps.location||'',priority:priorityFor(fail.label),status:'OPEN',action:'',resolutionNotes:'',
        updatedAt:now,resolvedAt:null,closedAt:null
      });
      added++;
    }
    recalc(ps.assetId);
  }
  return added;
}

router.get('/api/vehicle-defects',(req,res)=>{
  syncDefectsFromPrestarts();
  res.set('Cache-Control','no-store');
  res.json(vehicleDefects);
});

router.patch('/api/vehicle-defects/:id',(req,res)=>{
  syncDefectsFromPrestarts();
  const d=vehicleDefects.find(x=>String(x.id)===String(req.params.id));
  if(!d)return res.status(404).json({error:'Defect not found'});
  const statuses=['OPEN','IN PROGRESS','RESOLVED','CLOSED'];
  const actions=['','REPAIR','REPLACED','CONTRACTOR'];
  const status=String(req.body?.status||d.status).toUpperCase();
  const action=String(req.body?.action??d.action??'').toUpperCase();
  const notes=String(req.body?.resolutionNotes??d.resolutionNotes??'').trim();
  if(!statuses.includes(status))return res.status(400).json({error:'Invalid status'});
  if(!actions.includes(action))return res.status(400).json({error:'Invalid action'});
  if(['RESOLVED','CLOSED'].includes(status)&&!action)return res.status(400).json({error:'Select REPAIR, REPLACED or CONTRACTOR before resolving a defect'});
  d.status=status;d.action=action;d.resolutionNotes=notes;d.updatedAt=new Date().toISOString();
  if(status==='RESOLVED'&&!d.resolvedAt)d.resolvedAt=d.updatedAt;
  if(status==='CLOSED'){if(!d.resolvedAt)d.resolvedAt=d.updatedAt;d.closedAt=d.updatedAt;}
  if(!['RESOLVED','CLOSED'].includes(status)){d.resolvedAt=null;d.closedAt=null;}
  recalc(d.assetId);
  res.json(d);
});

router.get('/vehicle-defects',(req,res)=>{
  syncDefectsFromPrestarts();
  res.send(page('defects','Vehicle Defects',`
<style>
.defectStats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.defectStat{background:#fff;border:1px solid #e3e8ef;border-radius:11px;padding:16px}.defectStat span{display:block;font-size:11px;color:#7f8a9a;font-weight:800;text-transform:uppercase}.defectStat b{display:block;font-size:26px;margin-top:5px}.defToolbar{display:flex;gap:10px;justify-content:space-between;margin-bottom:14px}.defToolbar input,.defToolbar select{max-width:280px}.priority{font-weight:800;font-size:11px}.priority.HIGH{color:#b42318}.priority.MEDIUM{color:#ad7410}.priority.LOW{color:#1768c5}.defSelect{min-width:125px}.defNotes{min-width:190px}.archiveHead{margin-top:28px}.assetLink{color:#1768c5;text-decoration:none;font-weight:800}@media(max-width:800px){.defectStats{grid-template-columns:1fr 1fr}.defToolbar{display:grid}.defToolbar input,.defToolbar select{max-width:none}}
</style>
<div class="title"><div><h1>Vehicle Defects</h1><p>Outstanding defects automatically raised from failed Pre-Start items.</p></div></div>
<div id="stats" class="defectStats"></div>
<div class="defToolbar"><input id="search" placeholder="Search rego, asset or defect..."><select id="priority"><option value="">All Priorities</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select></div>
<section class="panel"><div class="tablewrap"><table><thead><tr><th>Date</th><th>Priority</th><th>Asset / Rego</th><th>Defect</th><th>Status</th><th>Action</th><th>Resolution Notes</th><th></th></tr></thead><tbody id="openRows"></tbody></table></div></section>
<div class="sectionhead archiveHead"><div><h2 style="margin:0">Defect Archive</h2><div class="sub">Resolved and closed defects remain linked to the asset history.</div></div></div>
<section class="panel"><div class="tablewrap"><table><thead><tr><th>Raised</th><th>Resolved</th><th>Asset / Rego</th><th>Defect</th><th>Outcome</th><th>Notes</th></tr></thead><tbody id="archiveRows"></tbody></table></div></section>
<script>(()=>{
let rows=[];const $=id=>document.getElementById(id),fmt=v=>v?new Date(v).toLocaleString('en-AU',{dateStyle:'short',timeStyle:'short'}):'—',e=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function load(){const r=await fetch('/api/vehicle-defects',{cache:'no-store'});rows=await r.json();render();}
function render(){const open=rows.filter(x=>x.status==='OPEN').length,prog=rows.filter(x=>x.status==='IN PROGRESS').length,high=rows.filter(x=>!['RESOLVED','CLOSED'].includes(x.status)&&x.priority==='HIGH').length,arch=rows.filter(x=>['RESOLVED','CLOSED'].includes(x.status)).length;$('stats').innerHTML='<div class="defectStat"><span>Open</span><b>'+open+'</b></div><div class="defectStat"><span>In Progress</span><b>'+prog+'</b></div><div class="defectStat"><span>High Priority</span><b>'+high+'</b></div><div class="defectStat"><span>Archived</span><b>'+arch+'</b></div>';
const q=$('search').value.toLowerCase(),p=$('priority').value;const live=rows.filter(x=>!['RESOLVED','CLOSED'].includes(x.status)).filter(x=>(!p||x.priority===p)&&(!q||(String(x.rego)+' '+String(x.assetName)+' '+String(x.defect)).toLowerCase().includes(q))).sort((a,b)=>({HIGH:0,MEDIUM:1,LOW:2}[a.priority]-({HIGH:0,MEDIUM:1,LOW:2}[b.priority])||new Date(b.reportedAt)-new Date(a.reportedAt));
$('openRows').innerHTML=live.length?live.map(d=>'<tr><td>'+fmt(d.reportedAt)+'</td><td><span class="priority '+d.priority+'">'+d.priority+'</span></td><td><b>'+e(d.rego||d.assetId)+'</b><div class="sub">'+e(d.assetName)+'</div></td><td><b>'+e(d.defect)+'</b><div class="sub">Pre-Start '+e(d.prestartId)+'</div></td><td><select class="defSelect" data-status="'+d.id+'"><option '+(d.status==='OPEN'?'selected':'')+'>OPEN</option><option '+(d.status==='IN PROGRESS'?'selected':'')+'>IN PROGRESS</option><option>RESOLVED</option><option>CLOSED</option></select></td><td><select class="defSelect" data-action="'+d.id+'"><option value="">Select...</option><option '+(d.action==='REPAIR'?'selected':'')+'>REPAIR</option><option '+(d.action==='REPLACED'?'selected':'')+'>REPLACED</option><option '+(d.action==='CONTRACTOR'?'selected':'')+'>CONTRACTOR</option></select></td><td><input class="defNotes" data-notes="'+d.id+'" value="'+e(d.resolutionNotes||'')+'" placeholder="What was done?"></td><td><button class="primary" data-save="'+d.id+'">Save</button></td></tr>').join(''):'<tr><td colspan="8"><div class="empty">No outstanding defects.</div></td></tr>';
const archived=rows.filter(x=>['RESOLVED','CLOSED'].includes(x.status)).sort((a,b)=>new Date(b.resolvedAt||b.updatedAt)-new Date(a.resolvedAt||a.updatedAt));$('archiveRows').innerHTML=archived.length?archived.map(d=>'<tr><td>'+fmt(d.reportedAt)+'</td><td>'+fmt(d.resolvedAt||d.closedAt)+'</td><td><b>'+e(d.rego||d.assetId)+'</b><div class="sub">'+e(d.assetName)+'</div></td><td>'+e(d.defect)+'</td><td><span class="pill ok">'+e(d.status)+'</span><div class="sub">'+e(d.action||'—')+'</div></td><td>'+e(d.resolutionNotes||'—')+'</td></tr>').join(''):'<tr><td colspan="6"><div class="empty">No archived defects yet.</div></td></tr>';
document.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>save(b.dataset.save));}
async function save(id){const status=document.querySelector('[data-status="'+id+'"]').value,action=document.querySelector('[data-action="'+id+'"]').value,resolutionNotes=document.querySelector('[data-notes="'+id+'"]').value;const r=await fetch('/api/vehicle-defects/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,action,resolutionNotes})});const d=await r.json();if(!r.ok)return alert(d.error||'Unable to update defect');load();}
$('search').oninput=render;$('priority').onchange=render;load();
})();</script>`));
});

module.exports=router;

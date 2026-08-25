const express=require('express');
const router=express.Router();
const {page}=require('../layout');
const incidents=require('../incident-store');

const STATUSES=['OPEN','IN REVIEW','REFERRED EXTERNAL','CLOSED'];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const statusOf=r=>STATUSES.includes(String(r.status||'').toUpperCase())?String(r.status).toUpperCase():'OPEN';
const statusClass=s=>s==='CLOSED'?'statusClosed':s==='IN REVIEW'?'statusReview':s==='REFERRED EXTERNAL'?'statusExternal':'statusOpen';
const statusOptions=current=>STATUSES.map(s=>`<option${s===current?' selected':''}>${s}</option>`).join('');

router.patch('/api/incidents/:id/status',(req,res)=>{
  const row=incidents.get(req.params.id);
  if(!row)return res.status(404).json({error:'Incident not found'});
  const status=String(req.body?.status||'').trim().toUpperCase();
  if(!STATUSES.includes(status))return res.status(400).json({error:'Invalid incident status'});
  const now=new Date().toISOString();
  row.status=status;
  row.updatedAt=now;
  row.closedAt=status==='CLOSED'?(row.closedAt||now):null;
  incidents.save(row);
  res.json(row);
});

router.delete('/api/incidents/:id',(req,res)=>{
  if(!incidents.remove(req.params.id))return res.status(404).json({error:'Incident not found'});
  res.json({ok:true,id:req.params.id});
});

const css=`
.incManage{max-width:1220px;margin:0 auto}.incidentStats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.incidentStat{background:#fff;border:1px solid #e3e8ef;border-radius:11px;padding:16px}.incidentStat span{display:block;font-size:10px;color:#7f8a9a;font-weight:800;text-transform:uppercase}.incidentStat b{display:block;font-size:25px;margin-top:5px}.statusOpen{background:#fff3da;color:#9b6508}.statusReview{background:#eaf2fd;color:#1768c5}.statusExternal{background:#f4ebff;color:#7a35b8}.statusClosed{background:#eaf8f0;color:#17884c}.statusSelect{min-width:155px}.rowActions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.archiveHead{margin-top:30px}.dangerMini{padding:8px 10px;border:1px solid #fecaca;background:#fff1f2;color:#b42318;border-radius:8px;font-weight:700;cursor:pointer}.manageBox{background:#fff;border:1px solid #e3e8ef;border-radius:12px;padding:15px;margin-bottom:18px}.manageRow{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.manageRow .field{min-width:240px;flex:1}.detailDesc{white-space:pre-wrap;line-height:1.55}.signaturePreview{max-width:320px;border:1px solid #e4e7ec;border-radius:8px}.incidentMedia{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:9px}.incidentMedia img{width:100%;height:110px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb}.fileChip{border:1px solid #e0e6ed;border-radius:8px;padding:8px 10px;background:#fff;font-size:11px;display:flex;justify-content:space-between;gap:8px;align-items:center}@media(max-width:800px){.incidentStats{grid-template-columns:1fr 1fr}.rowActions{min-width:220px}.manageRow{display:grid}.title{flex-direction:column;align-items:stretch}}
`;

function rowHtml(r,archived=false){
  const s=statusOf(r);
  return `<tr><td><b>${esc(r.id)}</b><div class="sub">${r.thirdPartyInvolved?'Third party involved':'Internal incident'}</div></td><td>${esc(r.incidentDate)} ${esc(r.incidentTime)}</td><td><b>${esc(r.vehicleRego||r.vehicleId)}</b><div class="sub">${esc(r.vehicleName)}</div></td><td>${esc(r.employeeName)}</td><td>${esc(r.weatherConditions)}</td><td><span class="pill ${statusClass(s)}">${esc(s)}</span>${archived&&r.closedAt?`<div class="sub">Closed ${new Date(r.closedAt).toLocaleDateString('en-AU')}</div>`:''}</td><td><div class="rowActions"><select class="statusSelect" data-status="${esc(r.id)}">${statusOptions(s)}</select><button class="primary" data-save="${esc(r.id)}">Save</button><a class="mini" href="/incident-register/${encodeURIComponent(r.id)}">View</a><button class="dangerMini" data-delete="${esc(r.id)}">Delete</button></div></td></tr>`;
}

router.get('/incident-register',(req,res)=>{
  const all=[...incidents.list()].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  const active=all.filter(r=>statusOf(r)!=='CLOSED');
  const archived=all.filter(r=>statusOf(r)==='CLOSED');
  const counts={open:all.filter(r=>statusOf(r)==='OPEN').length,review:all.filter(r=>statusOf(r)==='IN REVIEW').length,external:all.filter(r=>statusOf(r)==='REFERRED EXTERNAL').length,closed:archived.length};
  const activeRows=active.length?active.map(r=>rowHtml(r)).join(''):'<tr><td colspan="7"><div class="empty">No active incidents.</div></td></tr>';
  const archivedRows=archived.length?archived.map(r=>rowHtml(r,true)).join(''):'<tr><td colspan="7"><div class="empty">No closed incidents archived yet.</div></td></tr>';
  res.send(page('incident-register','Incident Register',`<style>${css}</style><div class="incManage"><section class="title"><div><h1>Incident Register</h1><p>Manage active incidents through review, external referral and closure.</p></div><a class="primary" href="/incident-register/new">＋ New Incident</a></section><div class="incidentStats"><div class="incidentStat"><span>Open</span><b>${counts.open}</b></div><div class="incidentStat"><span>In Review</span><b>${counts.review}</b></div><div class="incidentStat"><span>Referred External</span><b>${counts.external}</b></div><div class="incidentStat"><span>Closed / Archived</span><b>${counts.closed}</b></div></div><section class="panel"><div class="tablewrap"><table><thead><tr><th>Incident</th><th>Date / Time</th><th>Vehicle</th><th>Employee</th><th>Weather</th><th>Status</th><th>Actions</th></tr></thead><tbody>${activeRows}</tbody></table></div></section><div class="sectionhead archiveHead"><div><h2>Incident Archive</h2><div class="sub">Closed incidents are automatically moved here and retained for compliance history.</div></div></div><section class="panel"><div class="tablewrap"><table><thead><tr><th>Incident</th><th>Date / Time</th><th>Vehicle</th><th>Employee</th><th>Weather</th><th>Status</th><th>Actions</th></tr></thead><tbody>${archivedRows}</tbody></table></div></section></div><script>(()=>{async function save(id){const el=document.querySelector('[data-status="'+id+'"]');const r=await fetch('/api/incidents/'+encodeURIComponent(id)+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:el.value})});const j=await r.json();if(!r.ok)return alert(j.error||'Unable to update incident');location.reload()}async function del(id){if(!confirm('Delete incident '+id+'? This permanently removes the incident and its attachments.'))return;const r=await fetch('/api/incidents/'+encodeURIComponent(id),{method:'DELETE'}),j=await r.json();if(!r.ok)return alert(j.error||'Unable to delete incident');location.reload()}document.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>save(b.dataset.save));document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>del(b.dataset.delete))})();</script>`));
});

router.get('/incident-register/:id',(req,res,next)=>{
  if(req.params.id==='new')return next();
  const r=incidents.get(req.params.id);
  if(!r)return next();
  const s=statusOf(r);
  const trailerHtml=(r.trailers||[]).length?(r.trailers||[]).map(t=>`${esc(t.rego||t.id)} (${esc(t.name||t.type)})`).join(', '):'—';
  const imageHtml=(r.images||[]).length?`<div class="incidentMedia">${r.images.map(x=>`<img src="${esc(x.data)}" alt="Incident image">`).join('')}</div>`:'<div class="sub">No images attached.</div>';
  const docsHtml=(r.documents||[]).length?`<div style="display:grid;gap:7px">${r.documents.map(x=>`<div class="fileChip"><span>${esc(x.name)}</span><a class="mini" download="${esc(x.name)}" href="${esc(x.data)}">Open</a></div>`).join('')}</div>`:'<div class="sub">No documents attached.</div>';
  res.send(page('incident-register','Incident Details',`<style>${css}</style><div class="incManage"><section class="title"><div><h1>${esc(r.id)}</h1><p>${esc(r.vehicleRego||r.vehicleId)} · ${esc(r.employeeName)} · ${esc(r.incidentDate)} ${esc(r.incidentTime)}</p></div><a class="secondary" href="/incident-register">← Back to Register</a></section><div class="manageBox"><div class="manageRow"><div class="field"><label>Incident Status</label><select id="incidentStatus">${statusOptions(s)}</select></div><button class="primary" id="saveStatus">Update Status</button><button class="dangerMini" id="deleteIncident">Delete Incident</button></div><div class="sub" style="margin-top:8px">Closing an incident automatically moves it to the Incident Archive.</div></div><section class="panel"><div class="viewerbody"><div class="detailgrid"><div class="detail"><small>Vehicle</small><b>${esc(r.vehicleRego||r.vehicleId)}</b><div class="sub">${esc(r.vehicleName)}</div></div><div class="detail"><small>Employee</small><b>${esc(r.employeeName)}</b></div><div class="detail"><small>Weather</small><b>${esc(r.weatherConditions)}</b></div><div class="detail"><small>Date / Time</small><b>${esc(r.incidentDate)} ${esc(r.incidentTime)}</b></div><div class="detail"><small>Third Party</small><b>${r.thirdPartyInvolved?'Yes':'No'}</b></div><div class="detail"><small>Status</small><span class="pill ${statusClass(s)}">${esc(s)}</span></div></div><h3>Incident Description</h3><div class="detailDesc">${esc(r.incidentDescription)}</div><h3>Trailers</h3><p>${trailerHtml}</p>${r.thirdPartyInvolved?`<h3>Third Party Details</h3><div class="detailDesc">${esc(r.thirdPartyDetails)}</div>`:''}<h3>Acknowledgement</h3><p>${esc(r.acknowledgementName)} · ${esc(r.acknowledgementDate)}</p><h3>Signature</h3><img class="signaturePreview" src="${esc(r.signature)}" alt="Signature"><h3>Images</h3>${imageHtml}<h3>Documents / Video</h3>${docsHtml}</div></section></div><script>(()=>{const id=${JSON.stringify(String(r.id))};document.getElementById('saveStatus').onclick=async()=>{const r=await fetch('/api/incidents/'+encodeURIComponent(id)+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:document.getElementById('incidentStatus').value})}),j=await r.json();if(!r.ok)return alert(j.error||'Unable to update status');location.href='/incident-register'};document.getElementById('deleteIncident').onclick=async()=>{if(!confirm('Delete incident '+id+'? This permanently removes the incident and its attachments.'))return;const r=await fetch('/api/incidents/'+encodeURIComponent(id),{method:'DELETE'}),j=await r.json();if(!r.ok)return alert(j.error||'Unable to delete incident');location.href='/incident-register'}})();</script>`));
});

module.exports=router;

const express=require('express');
const PDFDocument=require('pdfkit');
const nodemailer=require('nodemailer');
const router=express.Router();
const {page}=require('../layout');
const db=require('../persistent-store');

const clean=v=>String(v??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v));

function writePrestartPdf(doc,r){
  doc.fontSize(20).text('Supervisor365 Pre-Start Inspection');
  doc.moveDown(.5);
  doc.fontSize(10).text(`Inspection ID: ${r.id}`).text(`Completed: ${new Date(r.completedAt).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})}`);
  doc.moveDown();
  doc.fontSize(14).text(`${r.assetName} — ${r.rego}`);
  doc.fontSize(10).text(`Asset Type: ${r.assetType}`).text(`Inspector: ${r.inspector}`).text(`Reading: ${r.reading}`).text(`Location: ${r.location||'—'}`).text(`Address: ${r.address||'—'}`).text(`Overall Result: ${r.status}`);
  doc.moveDown();
  doc.fontSize(13).text('Inspection Checklist');
  (r.results||[]).forEach(x=>doc.fontSize(9).text(`${x.label}: ${String(x.value).toUpperCase()}`));
  if(r.notes){doc.moveDown();doc.fontSize(12).text('Additional Notes');doc.fontSize(9).text(r.notes)}
  if(r.signature&&r.signature.startsWith('data:image/png;base64,')){try{doc.moveDown();doc.fontSize(12).text('Inspector Signature');doc.image(Buffer.from(r.signature.split(',')[1],'base64'),{fit:[260,100]})}catch{}}
}

function prestartPdfBuffer(r){
  return new Promise((resolve,reject)=>{
    const chunks=[];
    const doc=new PDFDocument({margin:42});
    doc.on('data',chunk=>chunks.push(chunk));
    doc.on('end',()=>resolve(Buffer.concat(chunks)));
    doc.on('error',reject);
    writePrestartPdf(doc,r);
    doc.end();
  });
}

function mailTransport(){
  const host=clean(process.env.SMTP_HOST),user=clean(process.env.SMTP_USER),pass=String(process.env.SMTP_PASS||'');
  if(!host||!user||!pass)return null;
  return nodemailer.createTransport({host,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE||'').toLowerCase()==='true',auth:{user,pass}});
}

router.get('/api/prestarts',(req,res)=>{res.set('Cache-Control','no-store');res.json([...db.listPrestarts()].reverse())});
router.get('/api/prestarts/:id',(req,res)=>{const r=db.getPrestart(req.params.id);if(!r)return res.status(404).json({error:'not found'});res.json(r)});
router.get('/api/prestarts/:id/pdf',(req,res)=>{
  const r=db.getPrestart(req.params.id);if(!r)return res.status(404).send('Inspection not found');
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`attachment; filename="${r.id}-${r.rego}.pdf"`);
  const doc=new PDFDocument({margin:42});doc.pipe(res);writePrestartPdf(doc,r);doc.end();
});
router.post('/api/prestarts/:id/email',async(req,res)=>{
  try{
    const r=db.getPrestart(req.params.id);if(!r)return res.status(404).json({error:'Inspection not found'});
    const to=clean(req.body?.email);
    if(!validEmail(to))return res.status(400).json({error:'Enter a valid recipient email address'});
    const transport=mailTransport();
    if(!transport)return res.status(503).json({error:'Email is not configured. Add SMTP_HOST, SMTP_USER and SMTP_PASS to the Supervisor365 environment first.',code:'SMTP_NOT_CONFIGURED'});
    const pdf=await prestartPdfBuffer(r);
    const completed=new Date(r.completedAt).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'});
    const subject=`Pre-Start Inspection ${r.id} — ${r.rego||r.assetName}`;
    const html=`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172433"><h2 style="margin-bottom:6px">Supervisor365 Pre-Start Inspection</h2><p style="color:#667085;margin-top:0">Completed inspection record attached as PDF.</p><table style="border-collapse:collapse;width:100%;font-size:14px"><tr><td style="padding:8px 0;color:#667085">Inspection</td><td style="padding:8px 0;font-weight:700">${esc(r.id)}</td></tr><tr><td style="padding:8px 0;color:#667085">Asset</td><td style="padding:8px 0;font-weight:700">${esc(r.assetName)} · ${esc(r.rego)}</td></tr><tr><td style="padding:8px 0;color:#667085">Inspector</td><td style="padding:8px 0">${esc(r.inspector)}</td></tr><tr><td style="padding:8px 0;color:#667085">Completed</td><td style="padding:8px 0">${esc(completed)}</td></tr><tr><td style="padding:8px 0;color:#667085">Result</td><td style="padding:8px 0;font-weight:700">${esc(r.status)}</td></tr></table><p style="font-size:12px;color:#8792a2;margin-top:24px">Sent from Supervisor365.</p></div>`;
    const info=await transport.sendMail({from:clean(process.env.MAIL_FROM)||'Supervisor365 <no-reply@supervisor365.com.au>',to,subject,html,attachments:[{filename:`${r.id}-${r.rego||'prestart'}.pdf`,content:pdf,contentType:'application/pdf'}]});
    res.json({ok:true,sent:true,to,messageId:info.messageId||''});
  }catch(e){console.error('Pre-start email failed:',e);res.status(500).json({error:'Unable to send pre-start email. '+(e.message||'')})}
});

router.get('/prestart-history',(req,res)=>res.send(page('prestart-history','Pre-Start History',`<style>.histActions{display:flex;gap:7px;flex-wrap:wrap}.histIcon{min-width:38px;height:38px;padding:0 9px;border:1px solid #d9e0e8;border-radius:9px;background:#fff;display:grid;place-items:center;color:#526175;cursor:pointer;text-decoration:none;font:inherit;font-size:10px;font-weight:800}.histIcon:hover{background:#f4f8fc;border-color:#a9c8e6}.historyFilters{display:flex;gap:10px;margin-bottom:14px}.historyFilters input,.historyFilters select{max-width:280px}.emailModal{display:none;position:fixed;inset:0;background:#0f172a99;z-index:1000;align-items:center;justify-content:center;padding:20px}.emailModal.open{display:flex}.emailBox{width:min(500px,96vw);background:#fff;border-radius:16px;box-shadow:0 28px 80px #0005;overflow:hidden}.emailHead{padding:18px 20px;border-bottom:1px solid #e6ebf1;display:flex;justify-content:space-between;gap:12px}.emailHead h2{margin:0 0 4px}.emailBody{padding:20px}.emailActions{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid #e7ebf0;background:#fafbfc}.emailClose{border:0;background:none;font-size:25px;cursor:pointer}</style><section class="title"><div><h1>Pre-Start History</h1><p>Review, export and send completed pre-start inspection records.</p></div><a class="secondary" href="/prestarts">Open Mobile Pre-Start</a></section><div class="historyFilters"><input id="search" placeholder="Search asset, rego or inspection..."><select id="status"><option value="">All Results</option><option>Passed</option><option>Failed</option></select></div><section class="panel"><div class="tablewrap"><table><thead><tr><th>Inspection</th><th>Date / Time</th><th>Asset</th><th>Inspector</th><th>Result</th><th>Actions</th></tr></thead><tbody id="rows"></tbody></table></div></section><div class="modal" id="viewModal"><div class="box"><div class="modalhead"><h2>Pre-Start Inspection</h2><button class="close" id="closeView">×</button></div><div class="viewerbody" id="viewBody"></div><div class="actions" id="viewActions"></div></div></div><div class="emailModal" id="emailModal"><div class="emailBox"><div class="emailHead"><div><h2>Email Pre-Start</h2><div class="sub" id="emailSubtitle">Send completed inspection as PDF.</div></div><button type="button" class="emailClose" id="closeEmail">×</button></div><div class="emailBody"><div class="field"><label>Recipient Email *</label><input id="emailTo" type="email" autocomplete="email" placeholder="name@company.com.au"></div><div class="sub" style="margin-top:10px">The email includes the inspection summary and the completed Supervisor365 pre-start PDF as an attachment.</div></div><div class="emailActions"><button type="button" class="secondary" id="cancelEmail">Cancel</button><button type="button" class="primary" id="sendEmail">Send Email</button></div></div></div><script>(()=>{const $=id=>document.getElementById(id);let list=[],emailId='';const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));function render(){const q=$('search').value.toLowerCase(),s=$('status').value,rows=list.filter(r=>(!s||r.status===s)&&(!q||[r.id,r.assetName,r.rego,r.inspector].join(' ').toLowerCase().includes(q)));$('rows').innerHTML=rows.length?rows.map(r=>'<tr><td><b>'+safe(r.id)+'</b><div class="sub">'+safe(r.assetType)+'</div></td><td>'+new Date(r.completedAt).toLocaleString('en-AU')+'</td><td><b>'+safe(r.assetName)+'</b><div class="sub">'+safe(r.rego)+'</div></td><td>'+safe(r.inspector)+'</td><td><span class="pill '+(r.status==='Passed'?'ok':'bad')+'">'+safe(r.status)+'</span></td><td><div class="histActions"><button class="histIcon" data-view="'+safe(r.id)+'">View</button><a class="histIcon" href="/api/prestarts/'+encodeURIComponent(r.id)+'/pdf">PDF</a><button class="histIcon" data-email="'+safe(r.id)+'">Email</button></div></td></tr>').join(''):'<tr><td colspan="6"><div class="empty">No completed pre-starts found.</div></td></tr>';$('rows').querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>viewRecord(b.dataset.view));$('rows').querySelectorAll('[data-email]').forEach(b=>b.onclick=()=>openEmail(b.dataset.email))}async function load(){list=await fetch('/api/prestarts',{cache:'no-store'}).then(r=>r.json());render()}async function viewRecord(id){const r=await fetch('/api/prestarts/'+encodeURIComponent(id)).then(x=>x.json());$('viewBody').innerHTML='<div class="detailgrid"><div class="detail"><small>Inspection</small><b>'+safe(r.id)+'</b></div><div class="detail"><small>Asset</small><b>'+safe(r.assetName)+'</b><div class="sub">'+safe(r.rego)+' · '+safe(r.assetType)+'</div></div><div class="detail"><small>Result</small><span class="pill '+(r.status==='Passed'?'ok':'bad')+'">'+safe(r.status)+'</span></div></div><h3>Checklist</h3>'+(r.results||[]).map(x=>'<div class="resultrow"><span>'+safe(x.label)+'</span><b>'+safe(String(x.value).toUpperCase())+'</b></div>').join('')+(r.notes?'<h3>Additional Notes</h3><p>'+safe(r.notes)+'</p>':'')+'<h3>Inspector Signature</h3>'+(r.signature?'<img class="sigimg" src="'+r.signature+'">':'');$('viewActions').innerHTML='<a class="primary" href="/api/prestarts/'+encodeURIComponent(r.id)+'/pdf">Export PDF</a><button type="button" class="secondary" id="emailFromView">Email</button>';$('emailFromView').onclick=()=>{ $('viewModal').classList.remove('open');openEmail(r.id)};$('viewModal').classList.add('open')}function openEmail(id){const r=list.find(x=>String(x.id)===String(id));emailId=id;$('emailSubtitle').textContent=r?((r.rego||r.assetName)+' · '+r.id):'Send completed inspection as PDF.';$('emailTo').value='';$('emailModal').classList.add('open');setTimeout(()=>$('emailTo').focus(),30)}function closeEmail(){$('emailModal').classList.remove('open');emailId=''}async function sendEmail(){const email=$('emailTo').value.trim();if(!email)return alert('Enter the recipient email address.');if(!emailId)return;const btn=$('sendEmail');btn.disabled=true;btn.textContent='Sending…';try{const response=await fetch('/api/prestarts/'+encodeURIComponent(emailId)+'/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}),data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to send email');alert('Pre-start emailed successfully to '+data.to);closeEmail()}catch(e){alert(e.message)}finally{btn.disabled=false;btn.textContent='Send Email'}}$('search').oninput=render;$('status').onchange=render;$('closeView').onclick=()=>$('viewModal').classList.remove('open');$('closeEmail').onclick=closeEmail;$('cancelEmail').onclick=closeEmail;$('sendEmail').onclick=sendEmail;$('emailModal').onclick=e=>{if(e.target===$('emailModal'))closeEmail()};$('emailTo').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();sendEmail()}};load()})();</script>`)));
module.exports=router;

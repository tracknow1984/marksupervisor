const express=require('express');
const PDFDocument=require('pdfkit');
const services=require('../service-store');
const {assets}=require('../store');
const types=require('../service-types');
const mailer=require('../company-mailer');
const router=express.Router();
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v))?String(v).split('-').reverse().join('.'):'Not recorded';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function snapshot(){
 const current=today();
 const rows=services.list().filter(r=>r.status==='SCHEDULED').sort((a,b)=>String(a.requestedDate).localeCompare(String(b.requestedDate))).map(r=>{
  const a=assets.find(a=>String(a.id)===String(r.assetId))||{};
  return{...r,plantId:a.plantId||'',rego:r.rego||a.rego||'',assetName:r.assetName||a.name||r.assetId,serviceType:types.label(r.serviceType),scheduleStatus:r.requestedDate?String(r.requestedDate)<current?'Overdue':r.requestedDate===current?'Due today':'Scheduled':'Date required'};
 });
 return{generatedAt:new Date(),rows,overdue:rows.filter(r=>r.scheduleStatus==='Overdue').length};
}
const csvCell=v=>'"'+String(v??'').replace(/^(\s*[=+@-])/,'\'$1').replace(/"/g,'""')+'"';
function csv(data){return '\uFEFF'+[['Requested date','Plant ID','Registration','Asset','Service type','Service centre','Status','Notes'],...data.rows.map(r=>[date(r.requestedDate),r.plantId,r.rego,r.assetName,r.serviceType,r.serviceCentre||'',r.scheduleStatus,r.notes||''])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'}
function pdf(data,company){return new Promise((resolve,reject)=>{
 const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true}),chunks=[];
 doc.on('data',c=>chunks.push(c));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
 doc.font('Helvetica-Bold').fontSize(22).fillColor('#14283d').text('Service Schedule');
 if(company)doc.font('Helvetica').fontSize(11).fillColor('#52657b').text(company);
 doc.font('Helvetica').fontSize(9).fillColor('#52657b').text('Snapshot: '+data.generatedAt.toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' (Brisbane)');
 doc.moveDown().font('Helvetica-Bold').fontSize(11).fillColor('#14283d').text(data.rows.length+' scheduled services  |  '+data.overdue+' overdue');
 doc.font('Helvetica').fontSize(9).fillColor('#52657b').text('Includes all open bookings, including overdue services.');doc.moveDown();
 if(!data.rows.length)doc.text('No upcoming services scheduled.');
 for(const r of data.rows){
  if(doc.y>doc.page.height-170)doc.addPage();
  const y=doc.y;doc.moveTo(42,y).lineTo(doc.page.width-42,y).strokeColor('#dce5ef').stroke();doc.y+=12;
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#14283d').text([r.plantId,r.rego,r.assetName].filter(Boolean).join(' | '));
  doc.fontSize(10).fillColor(r.scheduleStatus==='Overdue'?'#a72e2e':'#32618f').text(date(r.requestedDate)+'  ·  '+r.scheduleStatus);
  doc.font('Helvetica').fillColor('#29384b').text('Service: '+r.serviceType).text('Centre: '+(r.serviceCentre||'Not recorded'));
  if(r.notes)doc.fontSize(9).fillColor('#52657b').text('Notes: '+r.notes);
  doc.moveDown();
 }
 const pages=doc.bufferedPageRange();for(let i=pages.start;i<pages.start+pages.count;i++){doc.switchToPage(i);doc.font('Helvetica').fontSize(8).fillColor('#8390a0').text('Supervisor365  |  Page '+(i+1)+' of '+pages.count,42,doc.page.height-28,{lineBreak:false})}
 doc.end();
})}
router.get('/api/service-schedule/snapshot.csv',(req,res)=>res.type('text/csv').set('Content-Disposition','attachment; filename="service-schedule-'+today()+'.csv"').send(csv(snapshot())));
router.get('/api/service-schedule/snapshot.pdf',async(req,res)=>{try{const data=snapshot();const buffer=await pdf(data,decodeURIComponent(req.get('x-sv365-company-name')||''));res.type('application/pdf').set('Content-Disposition','attachment; filename="service-schedule-'+today()+'.pdf"').send(buffer)}catch(e){console.error('Schedule PDF failed',e);res.status(500).json({error:'Unable to generate schedule PDF'})}});
router.post('/api/service-schedule/email',async(req,res)=>{
 const to=String(req.body?.email||'').trim();if(to.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))return res.status(400).json({error:'Enter a valid recipient email address'});
 if(!mailer.configured())return res.status(503).json({error:'Email delivery is not configured. You can still download the PDF or CSV snapshot.'});
 try{const data=snapshot(),buffer=await pdf(data,decodeURIComponent(req.get('x-sv365-company-name')||''));const result=await mailer.send(to,'Supervisor365 Service Schedule · '+date(today()),'<p>Attached is your service schedule snapshot: '+data.rows.length+' scheduled services, including '+data.overdue+' overdue.</p>',[{filename:'service-schedule-'+today()+'.pdf',content:buffer,contentType:'application/pdf'}]);if(!result.sent)throw Error('Email not sent');res.json({ok:true,to,count:data.rows.length})}catch(e){console.error('Schedule email failed:',e.message);res.status(502).json({error:'Unable to send the schedule email. Please try again or download the snapshot.'})}
});
module.exports={router,snapshot,csv,pdf};

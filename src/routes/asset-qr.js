const express=require('express');
const QRCode=require('qrcode');
const router=express.Router();
const {page}=require('../layout');
const {assets}=require('../store');

const findAsset=id=>assets.find(a=>a.id===id);
const origin=req=>`${req.get('x-forwarded-proto')||req.protocol}://${req.get('host')}`;
const assetUrl=(req,a)=>`${origin(req)}/assets/${encodeURIComponent(a.id)}`;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

router.get('/assets/:id',(req,res)=>{
  const a=findAsset(req.params.id);if(!a)return res.status(404).send(page('assets','Asset Not Found','<section class="panel"><div class="empty">Asset not found.</div></section>'));
  const d=(label,v)=>`<div class="detail"><small>${label}</small><b>${esc(v||'—')}</b></div>`;
  const gallery=a.images&&a.images.length?`<h3 style="margin-top:24px">Asset Images</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">${a.images.map((src,i)=>`<a href="${src}" target="_blank" aria-label="Open asset photo ${i+1}"><img src="${src}" style="width:100%;height:160px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;display:block"></a>`).join('')}</div>`:'';
  res.send(page('assets',a.name,`<section class="title"><div><h1>${esc(a.name)}</h1><p>${esc(a.type)} · ${esc(a.rego)}${a.plantId?' · '+esc(a.plantId):''}</p></div><div class="actionlinks"><a class="secondary" href="/assets">← Assets</a><a class="primary" href="/assets/${encodeURIComponent(a.id)}/qr">QR Code</a></div></section><section class="panel"><div class="viewerbody"><div class="detailgrid">${d('Asset Type',a.type)}${d('Registration',a.rego)}${d('Registration State',a.registrationState)}${d('Registration Expiry',a.registrationExpiry)}${d('Status',a.status)}${d('Make',a.make)}${d('Model',a.model)}${d('VIN',a.vin)}${d('Current Odometer',Number(a.reading||0).toLocaleString('en-AU'))}${d('Acquisition Date',a.acquisitionDate)}${d('Category',a.category)}${d('Refrigeration Inspection',a.refrigerationInspectionDate)}${d('Handbrake Alarm',a.handbrakeAlarm?'Yes':'No')}${d('Reverse Camera',a.reverseCamera?'Yes':'No')}${d('ADAS 4-Way Video',a.adasVideo?'Yes':'No')}${d('Insurance Expiry',a.insuranceExpiry)}${d('Compliance Plate Date',a.compliancePlateDate)}${d('COI Number',a.coiNumber)}${d('COI Due Date',a.coiDueDate)}${d('Asset / Plant ID',a.plantId)}${d('Location',a.location)}</div>${gallery}<h3>Additional Notes</h3><p>${esc(a.additionalNotes||'—')}</p></div></section>`));
});

router.get('/assets/:id/qr',(req,res)=>{
  const a=findAsset(req.params.id);if(!a)return res.status(404).send('Asset not found');
  const url=assetUrl(req,a);
  res.send(page('assets','Asset QR Code',`<section class="title"><div><h1>Asset QR Code</h1><p>${esc(a.name)} · ${esc(a.rego)}</p></div><a class="secondary" href="/assets">← Back to Assets</a></section><section class="panel"><div class="viewerbody" style="text-align:center"><div style="display:inline-block;background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:24px"><img src="/assets/${encodeURIComponent(a.id)}/qr.svg" alt="QR code for ${esc(a.name)}" style="width:260px;height:260px;display:block"><div style="margin-top:14px;font-weight:800">${esc(a.name)}</div><div class="sub">${esc(a.rego)}${a.plantId?' · '+esc(a.plantId):''}</div></div><p class="sub" style="margin-top:16px">Scanning this code opens the live asset details page. The QR is tied to the asset's permanent internal ID.</p><div class="actionlinks" style="justify-content:center;margin-top:16px"><a class="primary" href="/assets/${encodeURIComponent(a.id)}/qr.svg?download=1">Download 65 mm SVG</a><a class="secondary" href="/assets/${encodeURIComponent(a.id)}/qr.png?download=1">Download PNG</a><a class="secondary" href="${url}" target="_blank">Test Scan Destination</a></div></div></section>`));
});

router.get('/assets/:id/qr.svg',async(req,res)=>{
  const a=findAsset(req.params.id);if(!a)return res.status(404).send('Asset not found');
  try{let svg=await QRCode.toString(assetUrl(req,a),{type:'svg',errorCorrectionLevel:'M',margin:2});svg=svg.replace(/<svg([^>]*)width="[^"]+"([^>]*)height="[^"]+"([^>]*)>/,'<svg$1width="65mm"$2height="65mm"$3>');if(!/width="65mm"/.test(svg))svg=svg.replace('<svg ','<svg width="65mm" height="65mm" ');res.setHeader('Content-Type','image/svg+xml');if(req.query.download)res.setHeader('Content-Disposition',`attachment; filename="${String(a.rego||a.id).replace(/[^a-z0-9_-]/gi,'_')}-QR-65mm.svg"`);res.send(svg)}catch(e){res.status(500).send('Unable to generate QR code')}
});
router.get('/assets/:id/qr.png',async(req,res)=>{const a=findAsset(req.params.id);if(!a)return res.status(404).send('Asset not found');try{const png=await QRCode.toBuffer(assetUrl(req,a),{type:'png',errorCorrectionLevel:'M',margin:4,width:768});res.setHeader('Content-Type','image/png');if(req.query.download)res.setHeader('Content-Disposition',`attachment; filename="${String(a.rego||a.id).replace(/[^a-z0-9_-]/gi,'_')}-QR-768px.png"`);res.send(png)}catch(e){res.status(500).send('Unable to generate QR code')}});
module.exports=router;

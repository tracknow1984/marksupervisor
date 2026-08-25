const express=require('express');
const router=express.Router();
const {page}=require('../layout');
const {assets,employees}=require('../store');
const incidents=require('../incident-store');

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const vehicleLabel=a=>`${a.rego||a.id} | ${a.make||''} ${a.model||a.name||''}`.replace(/\s+/g,' ').trim();
const employeeLabel=e=>`${e.firstName||''} ${e.lastName||''}${e.payrollIdentifier?' • '+e.payrollIdentifier:''}`.trim();
const trailerAssets=()=>assets.filter(a=>/trailer|dolly/i.test(String(a.type||'')));
const activeAssets=()=>assets.filter(a=>!['Retired','Sold','Decommissioned'].includes(a.status));

router.get('/api/incidents',(req,res)=>{
  res.set('Cache-Control','no-store');
  res.json([...incidents.list()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));
});
router.get('/api/incidents/:id',(req,res)=>{
  const row=incidents.get(req.params.id);
  if(!row)return res.status(404).json({error:'Incident not found'});
  res.json(row);
});
router.post('/api/incidents',(req,res)=>{
  try{
    const b=req.body||{};
    for(const f of ['vehicleId','employeeId','incidentDate','incidentTime','weatherConditions','incidentDescription','acknowledgementName','acknowledgementDate','signature']){
      if(!b[f])return res.status(400).json({error:`${f} is required`});
    }
    const vehicle=assets.find(a=>String(a.id)===String(b.vehicleId));
    if(!vehicle)return res.status(400).json({error:'Selected vehicle was not found'});
    const employee=employees.find(e=>String(e.id)===String(b.employeeId));
    if(!employee)return res.status(400).json({error:'Selected employee was not found'});
    if(b.thirdPartyInvolved&&!String(b.thirdPartyDetails||'').trim())return res.status(400).json({error:'Third party details are required when a third party is involved'});

    const trailerIds=Array.isArray(b.trailerIds)?b.trailerIds:[];
    const trailers=trailerIds.map(id=>assets.find(a=>String(a.id)===String(id))).filter(Boolean).map(a=>({id:a.id,rego:a.rego,name:a.name,type:a.type}));
    const images=Array.isArray(b.images)?b.images.slice(0,50):[];
    const documents=Array.isArray(b.documents)?b.documents.slice(0,50):[];
    const now=new Date().toISOString();
    const row={
      id:'INC-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),
      vehicleId:vehicle.id,vehicleRego:vehicle.rego,vehicleName:vehicle.name,vehicleType:vehicle.type,
      employeeId:employee.id,employeeName:`${employee.firstName||''} ${employee.lastName||''}`.trim(),employeePayrollIdentifier:employee.payrollIdentifier||'',
      incidentDate:b.incidentDate,incidentTime:b.incidentTime,weatherConditions:String(b.weatherConditions),incidentDescription:String(b.incidentDescription).trim(),
      acknowledgementName:String(b.acknowledgementName).trim(),acknowledgementDate:b.acknowledgementDate,
      trailers,thirdPartyInvolved:!!b.thirdPartyInvolved,thirdPartyDetails:String(b.thirdPartyDetails||'').trim(),
      signature:b.signature,images,documents,createdAt:now,updatedAt:now,status:'OPEN'
    };
    incidents.save(row);
    res.status(201).json(row);
  }catch(e){console.error('Incident save failed:',e);res.status(500).json({error:'Unable to save incident'})}
});

const commonCss=`
.incWrap{max-width:1180px;margin:0 auto}.incForm{background:#fff;border:1px solid #e3e8ef;border-radius:14px;overflow:hidden}.incHead{padding:20px 22px;border-bottom:1px solid #e8edf3;background:#fbfcfe}.incHead h2{margin:0 0 4px}.incBody{padding:22px}.incGrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.incFull{grid-column:1/-1}.field label,.sectionLabel{display:block;font-size:12px;font-weight:800;margin-bottom:7px;color:#344054}.required:after{content:' *';color:#d92d20}.scanRow{display:grid;grid-template-columns:1fr auto;gap:8px}.scanBtn{white-space:nowrap;min-height:43px}.incidentText{min-height:145px!important}.sectionBox{border:1px solid #e4e9ef;border-radius:11px;padding:14px;background:#fafbfd}.trailerGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.trailerOpt{display:flex!important;gap:9px;align-items:center;border:1px solid #e2e7ed;border-radius:9px;padding:10px;background:#fff;font-weight:500!important;margin:0!important}.trailerOpt input{width:18px;height:18px}.trailerOpt span{display:flex;flex-direction:column}.trailerOpt small{color:#8a96a7;margin-top:2px}.thirdRow{display:flex;gap:10px;align-items:center}.thirdRow input{width:20px;height:20px}.sigHint{font-size:12px;color:#748094;margin:5px 0 10px}.sigActions{display:flex;justify-content:flex-end;margin-top:8px}.uploadTitle{font-weight:800;margin-bottom:10px}.uploadButtons{display:flex;gap:8px;flex-wrap:wrap}.uploadBox{border:2px dashed #cfd8e3;border-radius:11px;padding:18px;text-align:center;background:#fbfcfd;margin-top:10px;cursor:pointer}.uploadCounter{font-size:11px;color:#7d8998;margin-top:8px}.thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-top:12px}.thumb{border:1px solid #e0e6ed;border-radius:9px;overflow:hidden;background:#fff}.thumb img{width:100%;height:90px;object-fit:cover;display:block}.thumb div{font-size:10px;padding:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fileChip{border:1px solid #e0e6ed;border-radius:8px;padding:8px 10px;background:#fff;font-size:11px;display:flex;justify-content:space-between;gap:8px;align-items:center}.incActions{display:flex;justify-content:flex-end;gap:9px;padding:16px 22px;border-top:1px solid #e8edf3;background:#fafbfc}.statusOpen{background:#fff3da;color:#ad7410}.detailDesc{white-space:pre-wrap;line-height:1.55}.signaturePreview{max-width:320px;border:1px solid #e4e7ec;border-radius:8px}.incidentMedia{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:9px}.incidentMedia img{width:100%;height:110px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb}@media(max-width:760px){.content{padding:14px}.incGrid{grid-template-columns:1fr}.incFull{grid-column:auto}.scanRow{grid-template-columns:1fr}.trailerGrid{grid-template-columns:1fr}.incActions{position:sticky;bottom:0;z-index:4}.incActions>*{flex:1}.title{align-items:stretch;flex-direction:column}.title .primary{text-align:center;text-decoration:none}.title h1{font-size:24px}}
`;

router.get('/incident-register',(req,res)=>{
  const rows=[...incidents.list()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const tableRows=rows.length?rows.map(r=>`<tr><td><b>${esc(r.id)}</b><div class="sub">${r.thirdPartyInvolved?'Third party involved':'Internal incident'}</div></td><td>${esc(r.incidentDate)} ${esc(r.incidentTime)}</td><td><b>${esc(r.vehicleRego||r.vehicleId)}</b><div class="sub">${esc(r.vehicleName)}</div></td><td>${esc(r.employeeName)}</td><td>${esc(r.weatherConditions)}</td><td><span class="pill statusOpen">${esc(r.status||'OPEN')}</span></td><td><a class="mini" href="/incident-register/${encodeURIComponent(r.id)}">View</a></td></tr>`).join(''):'<tr><td colspan="7"><div class="empty">No incidents recorded yet.</div></td></tr>';
  res.send(page('incident-register','Incident Register',`<style>${commonCss}</style><div class="incWrap"><section class="title"><div><h1>Incident Register</h1><p>Record vehicle incidents from mobile or desktop and maintain a signed incident history.</p></div><a class="primary" href="/incident-register/new">＋ New Incident</a></section><section class="panel"><div class="tablewrap"><table><thead><tr><th>Incident</th><th>Date / Time</th><th>Vehicle</th><th>Employee</th><th>Weather</th><th>Status</th><th>Actions</th></tr></thead><tbody>${tableRows}</tbody></table></div></section></div>`));
});

router.get('/incident-register/new',(req,res)=>{
  const vehicleOptions=activeAssets().map(a=>`<option value="${esc(a.id)}">${esc(vehicleLabel(a))}</option>`).join('');
  const employeeOptions=employees.map(e=>`<option value="${esc(e.id)}">${esc(employeeLabel(e))}</option>`).join('');
  const trailerOptions=trailerAssets().map(a=>`<label class="trailerOpt"><input type="checkbox" class="trailerCheck" value="${esc(a.id)}"><span><b>${esc(a.rego||a.id)}</b><small>${esc(a.name||a.type)}</small></span></label>`).join('')||'<div class="sub">No trailer assets currently available.</div>';
  res.send(page('incident-register','New Incident',`<style>${commonCss}</style><div class="incWrap"><section class="title"><div><h1>New Incident</h1><p>Complete all required information and obtain the reporter signature.</p></div><a class="secondary" href="/incident-register">← Back to Register</a></section><section class="incForm"><div class="incHead"><h2>Incident Report</h2><div class="sub">Required fields are marked with an asterisk.</div></div><div class="incBody"><div class="incGrid">
<div class="field incFull"><label class="required">Select Vehicle</label><div class="scanRow"><select id="vehicle"><option value="">Select Vehicle</option>${vehicleOptions}</select><button type="button" class="secondary scanBtn" id="scanQr">▣ Scan QR Code</button></div></div>
<div class="field incFull"><label class="required">Involved Employee</label><select id="employee"><option value="">Select Employee</option>${employeeOptions}</select>${employees.length?'':'<div class="sub" style="margin-top:6px">No employees are available. Add an employee first.</div>'}</div>
<div class="field"><label class="required">Incident Date</label><input id="incidentDate" type="date"></div><div class="field"><label class="required">Incident Time</label><input id="incidentTime" type="time"></div>
<div class="field incFull"><label class="required">Weather Conditions</label><select id="weather"><option value="">Select Weather Conditions</option><option>Clear / Fine</option><option>Cloudy / Overcast</option><option>Light Rain</option><option>Heavy Rain</option><option>Storm / Lightning</option><option>Fog / Low Visibility</option><option>High Wind</option><option>Extreme Heat</option><option>Other</option></select></div>
<div class="field incFull"><label class="required">Incident Description</label><textarea id="description" class="incidentText" placeholder="Describe what happened, location, damage, sequence of events and immediate action taken..."></textarea></div>
<div class="field"><label class="required">Acknowledgement Name</label><input id="ackName"></div><div class="field"><label class="required">Acknowledgement Date</label><input id="ackDate" type="date"></div>
<div class="incFull sectionBox"><div class="sectionLabel">Optional — Trailers</div><div class="trailerGrid">${trailerOptions}</div></div>
<div class="incFull sectionBox"><label class="thirdRow"><input type="checkbox" id="thirdParty"><b>Third Party Involved</b></label><div id="thirdDetailsWrap" class="field hidden" style="margin-top:12px"><label>Third Party Details</label><textarea id="thirdDetails" placeholder="Name, company, phone, registration, insurance details and involvement..."></textarea></div></div>
<div class="incFull sectionBox"><div class="sectionLabel required">Signature</div><div class="sigHint">By signing, you confirm that all information provided is accurate and complete.</div><canvas class="signature" id="signature"></canvas><div class="sigHint">Touch or click to sign · Required</div><div class="sigActions"><button type="button" class="secondary" id="clearSig">Clear</button></div></div>
<div class="incFull sectionBox"><div class="uploadTitle">Images</div><div class="uploadButtons"><button type="button" class="secondary" id="takePhoto">📷 Take Photo</button><button type="button" class="secondary" id="uploadImage">⇧ Upload Image</button></div><input id="cameraInput" type="file" accept="image/*" capture="environment" class="hidden"><input id="imageInput" type="file" accept="image/*" multiple class="hidden"><div class="uploadCounter" id="imageCount">0 of 50 images used</div><div class="thumbs" id="imagePreview"></div></div>
<div class="incFull sectionBox"><div class="uploadTitle">Documents</div><div class="uploadButtons"><button type="button" class="secondary" id="uploadFiles">⇧ Upload Files</button><button type="button" class="secondary" id="recordVideo">● Record Video</button><button type="button" class="secondary" id="selectDocs">▣ Select Documents</button></div><div class="uploadBox" id="dropZone"><strong>Click to upload or drag and drop</strong><div class="sub">PDF, Word, Excel, text files or video</div></div><input id="docInput" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,video/*" multiple class="hidden"><input id="videoInput" type="file" accept="video/*" capture class="hidden"><div class="uploadCounter" id="docCount">0 of 50 documents used</div><div id="docPreview" style="display:grid;gap:7px;margin-top:10px"></div></div>
</div></div><div class="incActions"><a class="secondary" href="/incident-register">Cancel</a><button type="button" class="primary" id="saveIncident">Submit Incident</button></div></section></div>
<script>
(function(){
  function $(id){return document.getElementById(id)}
  var images=[],documents=[],signed=false;
  var now=new Date(),today=now.toISOString().slice(0,10);
  $('incidentDate').value=today;$('ackDate').value=today;$('incidentTime').value=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  $('thirdParty').addEventListener('change',function(){$('thirdDetailsWrap').classList.toggle('hidden',!this.checked)});

  function setupSignature(){var c=$('signature'),rect=c.getBoundingClientRect(),ratio=window.devicePixelRatio||1;c.width=Math.max(300,Math.floor(rect.width*ratio));c.height=Math.floor(150*ratio);var ctx=c.getContext('2d');ctx.scale(ratio,ratio);ctx.lineWidth=2;ctx.lineCap='round';var down=false;function pos(e){var b=c.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top}}c.addEventListener('pointerdown',function(e){down=true;c.setPointerCapture(e.pointerId);var p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)});c.addEventListener('pointermove',function(e){if(!down)return;var p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();signed=true});c.addEventListener('pointerup',function(){down=false});c.addEventListener('pointercancel',function(){down=false})}
  setupSignature();
  $('clearSig').addEventListener('click',function(){var c=$('signature');c.getContext('2d').clearRect(0,0,c.width,c.height);signed=false});

  function readDataUrl(file){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(r.result)};r.onerror=reject;r.readAsDataURL(file)})}
  async function compressImage(file){var src=await readDataUrl(file);return await new Promise(function(resolve){var img=new Image();img.onload=function(){var max=1200,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',0.72))};img.src=src})}
  async function addImages(files){for(var i=0;i<files.length&&images.length<50;i++){var f=files[i];if(!String(f.type).startsWith('image/'))continue;images.push({name:f.name,type:'image/jpeg',data:await compressImage(f)})}renderImages()}
  function renderImages(){$('imageCount').textContent=images.length+' of 50 images used';$('imagePreview').innerHTML=images.map(function(x,i){return '<div class="thumb"><img src="'+x.data+'"><div>'+x.name+'</div><button type="button" class="mini" data-rmimg="'+i+'">Remove</button></div>'}).join('');document.querySelectorAll('[data-rmimg]').forEach(function(b){b.addEventListener('click',function(){images.splice(Number(this.dataset.rmimg),1);renderImages()})})}
  async function addDocs(files){for(var i=0;i<files.length&&documents.length<50;i++){var f=files[i];if(f.size>4*1024*1024){alert(f.name+' is larger than 4 MB and was skipped.');continue}documents.push({name:f.name,type:f.type||'application/octet-stream',size:f.size,data:await readDataUrl(f)})}renderDocs()}
  function renderDocs(){$('docCount').textContent=documents.length+' of 50 documents used';$('docPreview').innerHTML=documents.map(function(x,i){return '<div class="fileChip"><span>'+x.name+' <span class="sub">'+Math.round((x.size||0)/1024)+' KB</span></span><button type="button" class="mini" data-rmdoc="'+i+'">Remove</button></div>'}).join('');document.querySelectorAll('[data-rmdoc]').forEach(function(b){b.addEventListener('click',function(){documents.splice(Number(this.dataset.rmdoc),1);renderDocs()})})}
  $('takePhoto').addEventListener('click',function(){$('cameraInput').click()});$('uploadImage').addEventListener('click',function(){$('imageInput').click()});$('cameraInput').addEventListener('change',function(e){addImages(e.target.files)});$('imageInput').addEventListener('change',function(e){addImages(e.target.files)});$('uploadFiles').addEventListener('click',function(){$('docInput').click()});$('selectDocs').addEventListener('click',function(){$('docInput').click()});$('recordVideo').addEventListener('click',function(){$('videoInput').click()});$('docInput').addEventListener('change',function(e){addDocs(e.target.files)});$('videoInput').addEventListener('change',function(e){addDocs(e.target.files)});$('dropZone').addEventListener('click',function(){$('docInput').click()});$('dropZone').addEventListener('dragover',function(e){e.preventDefault()});$('dropZone').addEventListener('drop',function(e){e.preventDefault();addDocs(e.dataTransfer.files)});

  function chooseAsset(raw){var s=String(raw||'').trim(),match=s.match(/\\/assets\\/([^/?#]+)/),id=match?decodeURIComponent(match[1]):s,options=$('vehicle').options;for(var i=0;i<options.length;i++){if(options[i].value===id||options[i].textContent.toLowerCase().indexOf(id.toLowerCase()+' |')===0){$('vehicle').value=options[i].value;return true}}return false}
  $('scanQr').addEventListener('click',async function(){if(window.BarcodeDetector&&navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){var stream=null;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});var video=document.createElement('video');video.srcObject=stream;video.playsInline=true;await video.play();var detector=new BarcodeDetector({formats:['qr_code']});for(var i=0;i<60;i++){await new Promise(function(r){setTimeout(r,150)});var codes=await detector.detect(video);if(codes&&codes[0]&&chooseAsset(codes[0].rawValue)){stream.getTracks().forEach(function(t){t.stop()});return}}}catch(e){}finally{if(stream)stream.getTracks().forEach(function(t){t.stop()})}}var code=prompt('Paste the Supervisor365 asset QR link or Asset ID:');if(code&&!chooseAsset(code))alert('That QR code does not match an available asset.')});

  $('saveIncident').addEventListener('click',async function(){if(!$('vehicle').value)return alert('Select Vehicle is required');if(!$('employee').value)return alert('Involved Employee is required');if(!$('incidentDate').value||!$('incidentTime').value)return alert('Incident date and time are required');if(!$('weather').value)return alert('Weather Conditions are required');if(!$('description').value.trim())return alert('Incident Description is required');if(!$('ackName').value.trim()||!$('ackDate').value)return alert('Acknowledgement name and date are required');if($('thirdParty').checked&&!$('thirdDetails').value.trim())return alert('Enter Third Party Details');if(!signed)return alert('Signature is required');var body={vehicleId:$('vehicle').value,employeeId:$('employee').value,incidentDate:$('incidentDate').value,incidentTime:$('incidentTime').value,weatherConditions:$('weather').value,incidentDescription:$('description').value,acknowledgementName:$('ackName').value,acknowledgementDate:$('ackDate').value,trailerIds:Array.from(document.querySelectorAll('.trailerCheck:checked')).map(function(x){return x.value}),thirdPartyInvolved:$('thirdParty').checked,thirdPartyDetails:$('thirdDetails').value,signature:$('signature').toDataURL('image/png'),images:images,documents:documents};var btn=this;btn.disabled=true;btn.textContent='Saving...';try{var response=await fetch('/api/incidents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var saved=await response.json();if(!response.ok)throw new Error(saved.error||'Unable to save incident');alert('Incident '+saved.id+' saved');window.location.href='/incident-register'}catch(e){alert(e.message)}finally{btn.disabled=false;btn.textContent='Submit Incident'}});
})();
</script>`));
});

router.get('/incident-register/:id',(req,res)=>{
  const r=incidents.get(req.params.id);
  if(!r)return res.status(404).send('Incident not found');
  const trailerHtml=(r.trailers||[]).length?(r.trailers||[]).map(t=>`${esc(t.rego||t.id)} (${esc(t.name||t.type)})`).join(', '):'—';
  const imageHtml=(r.images||[]).length?`<div class="incidentMedia">${r.images.map(x=>`<img src="${esc(x.data)}" alt="Incident image">`).join('')}</div>`:'<div class="sub">No images attached.</div>';
  const docsHtml=(r.documents||[]).length?`<div style="display:grid;gap:7px">${r.documents.map(x=>`<div class="fileChip"><span>${esc(x.name)}</span><a class="mini" download="${esc(x.name)}" href="${esc(x.data)}">Open</a></div>`).join('')}</div>`:'<div class="sub">No documents attached.</div>';
  res.send(page('incident-register','Incident Details',`<style>${commonCss}</style><div class="incWrap"><section class="title"><div><h1>${esc(r.id)}</h1><p>${esc(r.vehicleRego||r.vehicleId)} · ${esc(r.employeeName)} · ${esc(r.incidentDate)} ${esc(r.incidentTime)}</p></div><a class="secondary" href="/incident-register">← Back to Register</a></section><section class="panel"><div class="viewerbody"><div class="detailgrid"><div class="detail"><small>Vehicle</small><b>${esc(r.vehicleRego||r.vehicleId)}</b><div class="sub">${esc(r.vehicleName)}</div></div><div class="detail"><small>Employee</small><b>${esc(r.employeeName)}</b></div><div class="detail"><small>Weather</small><b>${esc(r.weatherConditions)}</b></div><div class="detail"><small>Date / Time</small><b>${esc(r.incidentDate)} ${esc(r.incidentTime)}</b></div><div class="detail"><small>Third Party</small><b>${r.thirdPartyInvolved?'Yes':'No'}</b></div><div class="detail"><small>Status</small><b>${esc(r.status||'OPEN')}</b></div></div><h3>Incident Description</h3><div class="detailDesc">${esc(r.incidentDescription)}</div><h3>Trailers</h3><p>${trailerHtml}</p>${r.thirdPartyInvolved?`<h3>Third Party Details</h3><div class="detailDesc">${esc(r.thirdPartyDetails)}</div>`:''}<h3>Acknowledgement</h3><p>${esc(r.acknowledgementName)} · ${esc(r.acknowledgementDate)}</p><h3>Signature</h3><img class="signaturePreview" src="${esc(r.signature)}" alt="Signature"><h3>Images</h3>${imageHtml}<h3>Documents / Video</h3>${docsHtml}</div></section></div>`));
});

module.exports=router;

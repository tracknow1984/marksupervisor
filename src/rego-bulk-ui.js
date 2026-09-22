module.exports=String.raw`(()=>{
 const $=id=>document.getElementById(id);let job=null,busy=false,fetching=false,lastProcessed=-1;
 function draw(){
  const active=job&&['running','paused','pausing'].includes(job.state),running=job&&['running','pausing'].includes(job.state);
  $('bulkUnknown').disabled=!!active||busy;$('bulkStart').disabled=!!active||busy;
  $('bulkPause').hidden=!job||job.state!=='running';$('bulkResume').hidden=!job||job.state!=='paused';$('bulkCancel').hidden=!active;
  $('bulkPause').disabled=busy;$('bulkResume').disabled=busy;$('bulkCancel').disabled=busy||!!running;
  $('bulkProgress').max=Math.max(1,job?.total||0);$('bulkProgress').value=job?.processed||0;
  $('bulkMessage').textContent=job?job.state.toUpperCase()+' — '+job.message:'Ready to check your fleet.';
  $('bulkCounts').textContent=job?job.processed+' / '+job.total+' processed · '+job.counts.updated+' updated · '+job.counts.skipped+' skipped · '+job.counts.failed+' failed · '+(job.counts.pending+job.counts.checking)+' remaining':'';
  $('bulkRows').replaceChildren();for(const item of job?.items||[]){const row=document.createElement('tr'),name=document.createElement('td'),result=document.createElement('td');name.textContent=(item.rego||'No rego')+' · '+item.name;result.textContent=item.state+' — '+(item.message||'Queued');row.append(name,result);$('bulkRows').append(row)}
  if(job&&job.processed!==lastProcessed){lastProcessed=job.processed;document.dispatchEvent(new Event('rego-bulk-updated'))}
  $('bulkRegoBtn').textContent=running?'Fleet Regos · Running':job?.state==='paused'?'Fleet Regos · Paused':'Check Fleet Regos';
 }
 async function get(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Unable to load fleet check. Please reopen this panel.');return r.json()}
 async function preview(){try{const p=await get('/api/rego-bulk/preview?includeUnknown='+$('bulkUnknown').checked);$('bulkPreview').textContent=p.eligible+' eligible · '+p.skipped+' skipped · '+p.total+' total assets. There is a 10-second gap between checks.'}catch(e){$('bulkPreview').textContent=e.message}}
 async function refresh(){if(fetching)return;fetching=true;try{job=(await get('/api/rego-bulk')).job;if(job&&['running','paused','pausing'].includes(job.state))$('bulkUnknown').checked=job.includeUnknown;draw()}catch(e){$('bulkMessage').textContent=e.message}finally{fetching=false}}
 $('bulkRegoBtn').onclick=()=>{$('bulkRegoModal').classList.add('open');$('bulkTerms').checked=false;void refresh().then(preview)};
 $('bulkUnknown').onchange=preview;
 async function action(action){if(busy)return;if(['start','resume'].includes(action)&&!$('bulkTerms').checked){$('bulkMessage').textContent='Tick the Queensland/TMR terms box before starting or resuming.';$('bulkTerms').focus();return}busy=true;draw();try{const r=await fetch('/api/rego-bulk/'+action,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({confirmQueensland:true,acceptTerms:$('bulkTerms').checked,includeUnknown:$('bulkUnknown').checked})});const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to update queue');job=data.job;$('bulkTerms').checked=false;busy=false;draw()}catch(e){busy=false;draw();$('bulkMessage').textContent=e.message+'. Reopen the panel to see the saved queue before retrying.'}}
 $('bulkStart').onclick=()=>action('start');$('bulkPause').onclick=()=>action('pause');$('bulkResume').onclick=()=>action('resume');$('bulkCancel').onclick=()=>action('cancel');
 void refresh();setInterval(()=>{if($('bulkRegoModal').classList.contains('open')||job&&['running','pausing'].includes(job.state))void refresh()},4000);
})();`;

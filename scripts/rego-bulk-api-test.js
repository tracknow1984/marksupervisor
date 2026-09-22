const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bulk-api-test-'));process.env.SV365_TENANT_ID='test';process.env.SV365_DATA_DIR=dir;process.env.SV365_SAMPLE_DATA='0';
const rego=require('../src/rego-check'),create=rego.createChecker;rego.createChecker=assets=>create(assets,async rego=>({rego,status:'REGISTERED',expiry:'2027-01-01'}));
const express=require('express'),app=express();app.use(express.json());app.use(require('../src/routes/assets'));const {assets}=require('../src/store');assets.push({id:'one',rego:'TEST1',registrationState:'QLD'});
const server=app.listen(0,'127.0.0.1',async()=>{try{
 const url='http://127.0.0.1:'+server.address().port;
 const post=(action,role,body={})=>fetch(url+'/api/rego-bulk/'+action,{method:'POST',headers:{'Content-Type':'application/json','x-sv365-user-role':role},body:JSON.stringify(body)});
 assert.equal((await post('start','Employee')).status,403);assert.equal((await post('start','Owner')).status,400);
 const preview=await(await fetch(url+'/api/rego-bulk/preview')).json();assert.equal(preview.eligible,1);
 const r=await post('start','Owner',{confirmQueensland:true,acceptTerms:true});assert.equal(r.status,200);
 await new Promise(r=>setTimeout(r,30));const job=(await(await fetch(url+'/api/rego-bulk')).json()).job;assert.equal(job.counts.updated,1);assert.equal(assets[0].registrationStatus,'REGISTERED');
 assert.equal((await post('pause','Owner')).status,200);assert.equal((await post('resume','Owner')).status,400);assert.equal((await post('cancel','Owner')).status,200);
 const html=await(await fetch(url+'/assets')).text();for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Function(m[1]);assert.ok(html.includes('Check Fleet Regos'));
 console.log('PASS bulk API: roles, terms, preview, saved update, pause/cancel and rendered scripts');
}catch(e){console.error(e);process.exitCode=1}finally{server.close();fs.rmSync(dir,{recursive:true,force:true})}});

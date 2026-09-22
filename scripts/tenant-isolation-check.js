// Real gateway + company workers, temporary accounts/data, no external messages.
const assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'s365-tenants-'));
process.env.SV365_DATA_DIR=root;process.env.SV365_SAMPLE_DATA='1';process.env.SV365_MAX_TENANT_WORKERS='2';
process.env.WIALON_TOKEN='legacy-token-must-not-be-inherited';process.env.SMTP_HOST='';process.env.ABR_GUID='';
const accounts=require('../src/company-account-store');
const {createGateway,tenantDirectory}=require('../src/tenant-gateway');
// ABN normalisation strips letters, so use distinct numeric test identifiers at the store seam.
function signup(letter,abn){return accounts.createCompanySignup({companyName:'Company '+letter,abn,contactName:'Admin '+letter,contactEmail:letter+'@example.invalid',accountsContact:'Accounts',accountsPhone:'0400000000',businessType:'Transport',username:'admin.'+letter,password:'Local-only-test-password-'+letter})}
const a=signup('a','51824753556'),b=signup('b','53004085616'),c=signup('c','12345678901');
fs.writeFileSync(path.join(root,'operations.json'),JSON.stringify({prestarts:[{id:'LEGACY-SECRET'}],defects:[]}));
const aDir=tenantDirectory(a.company.id);fs.mkdirSync(aDir,{recursive:true});fs.writeFileSync(path.join(aDir,'wialon-prestart.json'),JSON.stringify({token:'company-a-private-token',user:'Company A GPS'}));
const gateway=createGateway();let server,base;
async function request(url,cookie,method='GET',body,headers={}){const r=await fetch(base+url,{method,redirect:'manual',headers:{...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return{status:r.status,data,headers:r.headers}}
async function expect(url,cookie,status=200,method='GET',body,headers){const r=await request(url,cookie,method,body,headers);assert.equal(r.status,status,url+' '+JSON.stringify(r.data).slice(0,350));return r.data}
async function login(letter){const r=await request('/api/auth/login',null,'POST',{login:'admin.'+letter,password:'Local-only-test-password-'+letter});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
const asset=(rego)=>({type:'Rigid Truck',rego,status:'In Service',make:'Test',model:'Truck',reading:10,registrationExpiry:'2099-12-31'});
const employee=(name)=>({firstName:name,lastName:'Driver',dateOfBirth:'1985-01-01',gender:'Male',email:name+'@example.invalid',phone:'0400000000',nextOfKinName:'Contact',nextOfKinContact:'0400000001',nextOfKinRelationship:'Partner',employeeAccess:'Driver'});
(async()=>{
 server=await new Promise(resolve=>{const s=gateway.app.listen(0,'127.0.0.1',()=>resolve(s))});base='http://127.0.0.1:'+server.address().port;
 const ca=await login('a'),cb=await login('b'),cc=await login('c');
 for(const url of ['/api/assets','/api/employees','/api/dashboard/overview','/api/prestarts','/api/gps/live','/api/public/assets/LEGACY-SECRET'])await expect(url,null,401);
 await expect('/dashboard',null,302);await expect('/api/assets','sv365_session=fake',401);
 assert.deepEqual(await expect('/api/assets',ca),[]);assert.deepEqual(await expect('/api/assets',cb),[]);
 const aa=await expect('/api/assets',ca,201,'POST',{...asset('A-TRUCK'),companyId:b.company.id});const bb=await expect('/api/assets',cb,201,'POST',asset('B-TRUCK'));assert.notEqual(aa.id,bb.id);
 assert.equal((await expect('/api/assets',ca)).length,1);assert.equal((await expect('/api/assets',cb)).length,1);
 assert.equal((await expect('/api/assets',ca,200,'GET',undefined,{'x-company-id':b.company.id,'x-sv365-tenant-id':b.company.id,'x-sv365-user-role':'Owner','x-supervisor365-internal':'test'}))[0].rego,'A-TRUCK');
 assert.equal((await expect('/api/assets?companyId='+b.company.id,ca))[0].rego,'A-TRUCK');
 await expect('/api/assets/'+aa.id,cb,404);await expect('/api/assets/'+aa.id,cb,404,'PUT',asset('STOLEN'));
 const ea=await expect('/api/employees',ca,201,'POST',employee('Alice')),eb=await expect('/api/employees',cb,201,'POST',employee('Bob'));
 await expect('/api/employees/'+ea.id,cb,404);await expect('/api/employees/'+ea.id,cb,404,'PATCH',{firstName:'Hijacked'});
 const service=await expect('/api/services',ca,201,'POST',{vehicleId:aa.id,serviceType:'Truck A Service',requestedDate:'2099-01-01'});
 assert.deepEqual(await expect('/api/services',cb),[]);await expect('/service/'+service.id+'/cancel',cb,404,'POST',{});
 const ps=(assetId)=>({employeeId:ea.id,records:[{assetId,signature:'test-signature',fitnessForDutyAccepted:true,reading:12,results:[{itemId:'brakes',label:'Brakes',value:'fail'}]}]});
 const prestarts=await expect('/api/prestarts',ca,201,'POST',ps(aa.id));const prestart=prestarts[0];
 await expect('/api/prestarts',cb,400,'POST',ps(aa.id));
 assert.deepEqual(await expect('/api/vehicle-defects',cb),[]);const defects=await expect('/api/vehicle-defects',ca);assert.equal(defects.length,1);await expect('/api/vehicle-defects/'+defects[0].id,cb,404,'PATCH',{status:'RESOLVED'});
 await expect('/api/prestarts/'+prestart.id,cb,404);await expect('/api/prestarts/'+prestart.id+'/pdf',cb,404);
 const incident=await expect('/api/incidents',ca,201,'POST',{vehicleId:aa.id,employeeId:ea.id,incidentDate:'2026-09-22',incidentTime:'09:00',weatherConditions:'Fine',incidentDescription:'A private incident',acknowledgementName:'Alice',acknowledgementDate:'2026-09-22',signature:'test',documents:[{name:'private.txt',data:'company-a-document'}]});
 assert.deepEqual(await expect('/api/incidents',cb),[]);await expect('/api/incidents/'+incident.id,cb,404);
 const item=await expect('/api/prestart-items',ca,201,'POST',{assetType:'Rigid Truck',label:'Company A checklist'});await expect('/api/prestart-items/'+item.id,cb,404,'PUT',{label:'Changed'});await expect('/api/prestart-items/'+item.id,cb,404,'DELETE');
 await expect('/api/asset-types',ca,201,'POST',{name:'Company A Custom Class'});assert(!(await expect('/api/asset-types',cb)).includes('Company A Custom Class'));
 await expect('/api/modules/commit',ca,200,'POST',{enabledIds:['assets','employees','live-gps','maintenance']});assert(!(await expect('/api/modules',cb)).enabledIds.includes('maintenance'));
 assert.equal((await expect('/api/gps/wialon/status',ca)).configured,true);assert.equal((await expect('/api/gps/wialon/status',cb)).configured,false);
 const overviewA=await expect('/api/dashboard/overview',ca),overviewB=await expect('/api/dashboard/overview',cb);assert.equal(overviewA.counts.openDefects,1);assert.equal(overviewB.counts.openDefects,0);assert(!JSON.stringify(overviewB).includes('Alice'));
 // Inject records only through the local fixture directory to exercise all opaque-ID read paths.
 await gateway.pool.close();
 fs.writeFileSync(path.join(aDir,'ewd.json'),JSON.stringify({sessions:[{id:'EWD-A-PRIVATE',status:'COMPLETED',employeeId:ea.id,events:[]}],driverSecurity:{}}));
 fs.writeFileSync(path.join(aDir,'gps-shares.json'),JSON.stringify([{id:'SHARE-A',token:'A-PRIVATE-TOKEN',assetId:aa.id,expiresAt:'2099-01-01'}]));
 fs.writeFileSync(path.join(aDir,'compliance.json'),JSON.stringify({documents:[{id:'DOC-A-PRIVATE',subject:'A private policy',documents:[{id:'FILE-A',name:'a.txt',type:'text/plain',data:'data:text/plain;base64,cHJpdmF0ZQ=='}],recipients:[]}]}));
 await expect('/api/ewd/session/EWD-A-PRIVATE/export',cb,404);await expect('/api/gps/share/A-PRIVATE-TOKEN',cb,410);await expect('/api/compliance/documents/DOC-A-PRIVATE',cb,404);
 assert.equal((await expect('/api/assets',ca))[0].rego,'A-TRUCK');assert.equal((await expect('/api/assets',ca))[0].reading,12);assert.equal((await expect('/api/employees',ca))[0].firstName,'Alice');assert((await expect('/api/asset-types',ca)).includes('Company A Custom Class'));
 assert.equal((await expect('/api/services',ca))[0].id,service.id);assert.equal((await expect('/api/incidents',ca))[0].id,incident.id);
 // Two workers maximum; a third company must never reuse another company's memory.
 assert.deepEqual(await expect('/api/assets',cc),[]);assert.equal((await expect('/api/assets',cb))[0].rego,'B-TRUCK');assert.equal((await expect('/api/assets',ca))[0].rego,'A-TRUCK');assert(gateway.pool.workers.size<=2);
 const [ra,rb]=await Promise.all(Array.from({length:8},(_,i)=>expect('/api/assets',i%2?cb:ca)));assert(ra[0].rego!==rb[0].rego);
 const driver=accounts.createEmployeeUser(a.company.id,{firstName:'Driver',lastName:'Test',email:'driver@example.invalid',role:'Driver'});
 const dr=await request('/api/auth/login',null,'POST',{login:driver.user.username,password:driver.temporaryPassword});assert.equal(dr.status,200);const cd=dr.headers.get('set-cookie').split(';')[0];
 await expect('/api/assets',cd,403);await expect('/api/auth/change-password',cd,200,'POST',{password:'New-driver-test-password'});
 await expect('/api/assets',cd,200);await expect('/api/modules/commit',cd,403,'POST',{enabledIds:['maintenance']},{'x-sv365-user-role':'Owner'});
 const read=await request('/api/assets',ca);assert.match(read.headers.get('cache-control'),/no-store/);
 await expect('/api/assets',ca,403,'POST',asset('BAD'),{Origin:'https://other.example'});
 await expect('/api/auth/logout',ca,302);await expect('/api/assets',ca,401);await expect('/api/assets',cb,200);
 assert(fs.readFileSync(path.join(root,'operations.json'),'utf8').includes('LEGACY-SECRET'));
 assert.notEqual(tenantDirectory(a.company.id),tenantDirectory(b.company.id));
 console.log('PASS: anonymous access, login, company header/body/query spoofing, assets, employees, services, prestarts, defects, incidents, checklists, modules, GPS credentials, dashboards, export/share/document IDs, concurrent requests, worker restart/eviction, logout and legacy quarantine.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await gateway.pool.close();if(server)await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true})});

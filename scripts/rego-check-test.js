const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {parseResult,dateISO,matchRegistration,createChecker}=require('../src/rego-check');
const text='Registration number\nXB06XI\nChassis number\nJ04940\nDescription\n1980 INTERNATIONAL T2670 TRUCK\nStatus\nEXPIRED\nExpiry date\n03/07/2026\nCurrent Inspection not recorded';
const result=parseResult(text);
const asset=()=>({id:'one',rego:'XB06XI',serialNumber:'J04940',registrationState:'',registrationExpiry:'2025-07-03',status:'In Service'});
test('parses only complete labelled TMR results and Australian dates',()=>{assert.equal(result.expiry,'2026-07-03');assert.deepEqual(Object.keys(result).sort(),['expiry','rego','status']);assert.throws(()=>dateISO('31/02/2026'));assert.throws(()=>parseResult('Registration number\nXB06XI\nNo results'));assert.throws(()=>parseResult(text.replace('EXPIRED','UNKNOWN')))});
test('matches registration only, with no VIN or chassis requirement',()=>{assert.equal(matchRegistration(asset(),result),'Queensland registration number');assert.equal(matchRegistration({...asset(),serialNumber:'',vin:''},result),'Queensland registration number');assert.equal(matchRegistration({...asset(),vin:'OTHER'},{...result,vin:'DIFFERENT'}),'Queensland registration number');assert.throws(()=>matchRegistration({...asset(),rego:'OTHER'},result))});
test('saves verified fields atomically to company storage and keeps operating status',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rego-test-'));process.env.SV365_TENANT_ID='test';process.env.SV365_DATA_DIR=dir;try{const assets=require('../src/tenant-collections').collection('assets',[asset()]);const check=createChecker(assets,async()=>result);assert.equal((await check('one','Admin')).ok,true);const saved=JSON.parse(fs.readFileSync(path.join(dir,'collection-assets.json')))[0];assert.equal(saved.registrationExpiry,'2026-07-03');assert.equal(saved.status,'In Service');assert.equal(saved.registrationCheck.previous.registrationExpiry,'2025-07-03');assert.equal(saved.registrationCheckHistory.length,1);assert.equal(saved.registrationState,'');await assert.rejects(()=>check('one','Admin'),/one minute/)}finally{fs.rmSync(dir,{recursive:true,force:true})}});
test('mismatch and provider failures retain prior details',async()=>{for(const provider of [async()=>({...result,rego:'BAD'}),async()=>{throw Error('internal secret')}]){const assets=[asset()];const response=await createChecker(assets,provider)('one','Admin');assert.equal(response.ok,false);assert.equal(assets[0].registrationExpiry,'2025-07-03');assert.equal(assets[0].registrationStatus,undefined);assert.doesNotMatch(response.check.message,/internal secret/);assert.equal(assets[0].registrationCheckHistory.length,1)}});
test('concurrent edits are not overwritten and duplicate checks are rejected',async()=>{let release;const pending=new Promise(r=>release=r);const assets=[asset()];const check=createChecker(assets,()=>pending);const a=check('one','Admin');await assert.rejects(()=>check('one','Admin'),/already running/);assets[0].rego='CHANGED';release(result);assert.equal((await a).ok,false);assert.equal(assets[0].rego,'CHANGED');assert.equal(assets[0].registrationExpiry,'2025-07-03')});
test('rejects interstate and missing assets before calling provider',async()=>{let called=false;const check=createChecker([{...asset(),registrationState:'NSW'}],async()=>{called=true;return result});await assert.rejects(()=>check('one','Admin'),/outside Queensland/);await assert.rejects(()=>check('other-company-id','Admin'),/not found/);assert.equal(called,false)});

test('parses the observed TMR result with whitespace in definition terms',()=>{const actual=`Check registration status
View results
Current Inspection not recorded
Please note
Driving with an expired certificate of inspection (COI) is an offence
Registration details
Registration number
\t\t\tXB06XI
Chassis
\t\tJ04940
Description
1980 INTERNATIONAL T2670 TRUCK
Gross Vehicle Mass (GVM)
20800 kgs
Purpose of use
COMMERCIAL
Status
\t\t\t
EXPIRED
Expiry
03/07/2026
Renew Now
Search Again
Exit`;const parsed=parseResult(actual);assert.equal(parsed.rego,'XB06XI');assert.equal(parsed.status,'EXPIRED');assert.equal(parsed.expiry,'2026-07-03');assert.equal(matchRegistration(asset(),parsed),'Queensland registration number')});

test('updates only registration fields and audit metadata',async()=>{const original={...asset(),vin:'MISMATCH',serialNumber:'OTHER',registrationInspectionWarning:'Existing inspection note',coiDueDate:'2027-03-01',make:'International',reading:123};const assets=[original];const response=await createChecker(assets,async()=>({...result,inspectionWarning:'NEW WARNING',vin:'DIFFERENT'}))('one','Admin');assert.equal(response.ok,true);for(const key of ['vin','serialNumber','registrationInspectionWarning','coiDueDate','make','reading','registrationState','status'])assert.equal(assets[0][key],original[key],key);assert.deepEqual(Object.keys(assets[0].registrationCheck.result).sort(),['expiry','rego','status']);assert.ok(assets[0].registrationCheckedAt)});

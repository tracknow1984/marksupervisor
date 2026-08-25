const crypto=require('crypto');
const {assets,employees}=require('./store');
const operations=require('./persistent-store');
const incidents=require('./incident-store');
const services=require('./service-store');
const compliance=require('./compliance-store');

const enabled=()=>!['0','false','off','no'].includes(String(process.env.SV365_SAMPLE_DATA||'1').trim().toLowerCase());
const day=n=>new Date(Date.now()+Number(n||0)*86400000).toISOString().slice(0,10);
const stamp=(days=0,hours=0)=>new Date(Date.now()+Number(days||0)*86400000+Number(hours||0)*3600000).toISOString();
const token=()=>crypto.randomBytes(24).toString('hex');
const signature='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZqZsAAAAASUVORK5CYII=';

function assetDefaults(a){return{
  registrationState:'QLD',registrationExpiry:'',vin:'',acquisitionDate:day(-700),category:'',refrigerationInspectionDate:'',
  handbrakeAlarm:false,reverseCamera:false,adasVideo:false,insuranceExpiry:'',compliancePlateDate:day(-900),
  coiNumber:'',coiDueDate:'',plantId:'',additionalNotes:'Sample build-stage record',location:'North Maclean',serviceDue:false,openDefects:0,images:[],
  status:'In Service',reading:0,...a
}}

function sampleAssets(){return[
  assetDefaults({id:'SB-909',name:'Kenworth T909',make:'Kenworth',model:'T909',type:'Prime Mover',rego:'SB-909',category:'Heavy Transport',reading:84220,registrationExpiry:day(180),insuranceExpiry:day(105),coiNumber:'COI-909-26',coiDueDate:day(120),handbrakeAlarm:true,reverseCamera:true,adasVideo:true,plantId:'PM-001'}),
  assetDefaults({id:'TRL-A01',name:'MaxiTRANS A Trailer',make:'MaxiTRANS',model:'A Trailer',type:'A Trailer',rego:'TR-A01',category:'Heavy Transport',reading:0,registrationExpiry:day(18),insuranceExpiry:day(160),coiNumber:'COI-A01-26',coiDueDate:day(75),plantId:'TRL-001'}),
  assetDefaults({id:'TRL-B01',name:'MaxiTRANS B Trailer',make:'MaxiTRANS',model:'B Trailer',type:'B Trailer',rego:'TR-B01',category:'Heavy Transport',reading:0,registrationExpiry:day(-10),insuranceExpiry:day(145),coiNumber:'COI-B01-26',coiDueDate:day(95),plantId:'TRL-002'}),
  assetDefaults({id:'DOL-01',name:'Haulmark Dolly',make:'Haulmark',model:'Dolly',type:'Dolly',rego:'DOL-01',category:'Heavy Transport',reading:0,registrationExpiry:day(210),insuranceExpiry:'',coiNumber:'COI-DOL-26',coiDueDate:day(150),plantId:'DOL-001'}),
  assetDefaults({id:'EX-0320',name:'CAT 320 Excavator',make:'CAT',model:'320',type:'Excavator',rego:'EX-0320',category:'Plant & Machinery',status:'Maintenance',serviceDue:true,reading:3842,registrationExpiry:day(365),insuranceExpiry:day(210),coiNumber:'COI-EX320-26',coiDueDate:day(180),plantId:'EX-0320',additionalNotes:'Sample maintenance asset with an open pre-start defect.'}),
  assetDefaults({id:'LV-014',name:'Toyota Hilux',make:'Toyota',model:'Hilux',type:'Light Vehicle',rego:'LV-014',category:'Light Vehicles',location:'Gold Coast',serviceDue:true,reading:56200,registrationExpiry:day(25),insuranceExpiry:day(82),coiNumber:'COI-LV014-26',coiDueDate:day(140),reverseCamera:true,plantId:'LV-014'})
]}

function sampleEmployees(){return[
  {id:'EMP-DEMO-001',firstName:'Alex',lastName:'Turner',dateOfBirth:'1988-04-17',gender:'Male',email:'alex.turner@example.com',phone:'0400 100 101',lastDrivingAssessment:day(-90),address:'Brisbane QLD',licenceNo:'QLD-DEMO-1001',licenceExpiry:day(320),licenceState:'QLD',licenceClass:'HC',payrollIdentifier:'EMP001',classification:'Heavy Vehicle Driver',nextOfKinName:'Jamie Turner',nextOfKinContact:'0400 900 101',nextOfKinRelationship:'Partner',employeeAccess:'Driver',status:'Active',notificationPreferences:['Prestart Failures','License Expiry','Compliance Updates'],ncrReporter:false,compliance:{induction:{complete:true,signedOffDate:day(-220),signedOffBy:'Operations Manager'},licence:{checked:true,checkedDate:day(-30),checkedBy:'Safety Team'},medical:{current:true,reviewedDate:day(-60),expiryDate:day(300),reviewedBy:'Safety Team'}}},
  {id:'EMP-DEMO-002',firstName:'Jordan',lastName:'Lee',dateOfBirth:'1992-09-03',gender:'Female',email:'jordan.lee@example.com',phone:'0400 100 102',lastDrivingAssessment:day(-140),address:'Logan QLD',licenceNo:'QLD-DEMO-1002',licenceExpiry:day(110),licenceState:'QLD',licenceClass:'MC',payrollIdentifier:'EMP002',classification:'Driver / Operator',nextOfKinName:'Morgan Lee',nextOfKinContact:'0400 900 102',nextOfKinRelationship:'Relative',employeeAccess:'Driver',status:'Active',notificationPreferences:['Prestart Failures','License Expiry','Safety Briefings'],ncrReporter:true,compliance:{induction:{complete:true,signedOffDate:day(-180),signedOffBy:'Operations Manager'},licence:{checked:true,checkedDate:day(-20),checkedBy:'Safety Team'},medical:{current:false,reviewedDate:'',expiryDate:'',reviewedBy:''}}},
  {id:'EMP-DEMO-003',firstName:'Casey',lastName:'Morgan',dateOfBirth:'1985-01-26',gender:'Prefer not to say',email:'casey.morgan@example.com',phone:'0400 100 103',address:'Gold Coast QLD',licenceNo:'QLD-DEMO-1003',licenceExpiry:day(45),licenceState:'QLD',licenceClass:'C',payrollIdentifier:'EMP003',classification:'Operations Coordinator',nextOfKinName:'Riley Morgan',nextOfKinContact:'0400 900 103',nextOfKinRelationship:'Friend',employeeAccess:'Operations',status:'Active',notificationPreferences:['Incident Reports','Maintenance Alerts','Compliance Updates'],ncrReporter:false,compliance:{induction:{complete:true,signedOffDate:day(-75),signedOffBy:'Company Admin'},licence:{checked:false,checkedDate:'',checkedBy:''},medical:{current:false,reviewedDate:'',expiryDate:'',reviewedBy:''}}},
  {id:'EMP-DEMO-004',firstName:'Taylor',lastName:'Reed',dateOfBirth:'1990-06-12',gender:'Non-binary',email:'taylor.reed@example.com',phone:'0400 100 104',address:'Brisbane QLD',licenceNo:'',licenceExpiry:'',licenceState:'QLD',licenceClass:'',payrollIdentifier:'EMP004',classification:'Safety & Compliance Officer',nextOfKinName:'Sam Reed',nextOfKinContact:'0400 900 104',nextOfKinRelationship:'Partner',employeeAccess:'Safety & Compliance',status:'Active',notificationPreferences:['Incident Reports','Safety Briefings','Compliance Updates'],ncrReporter:true,compliance:{induction:{complete:false,signedOffDate:'',signedOffBy:''},licence:{checked:false,checkedDate:'',checkedBy:''},medical:{current:false,reviewedDate:'',expiryDate:'',reviewedBy:''}}}
]}

function seedInMemory(){
  if(!assets.length)assets.push(...sampleAssets());
  if(!employees.length)employees.push(...sampleEmployees());
}

function seedOperations(){
  if(operations.listPrestarts().length||operations.listDefects().length)return;
  const passed={id:'PS-DEMO-001',sessionId:'SESSION-DEMO-001',assetId:'SB-909',assetName:'Kenworth T909',assetType:'Prime Mover',rego:'SB-909',employeeId:'EMP-DEMO-001',employeeName:'Alex Turner',inspector:'Alex Turner',isPrimary:true,completedAt:stamp(-1,-2),inspectionDate:day(-1),location:'North Maclean',address:'Mount Lindesay Highway, North Maclean QLD',latitude:-27.76,longitude:153.01,locationAccuracy:8,locationCapturedAt:stamp(-1,-2),reading:84220,notes:'Sample passed pre-start.',results:[{itemId:3,label:'Registration Plates Affixed and Legible',value:'pass'},{itemId:4,label:'Compliance Plate Affixed',value:'pass'},{itemId:33,label:'Brake Operation',value:'pass'}],signature,status:'Passed',failedCount:0};
  operations.savePrestartWithDefects(passed,[]);
  const failed={id:'PS-DEMO-002',sessionId:'SESSION-DEMO-002',assetId:'EX-0320',assetName:'CAT 320 Excavator',assetType:'Excavator',rego:'EX-0320',employeeId:'EMP-DEMO-002',employeeName:'Jordan Lee',inspector:'Jordan Lee',isPrimary:true,completedAt:stamp(-2,-1),inspectionDate:day(-2),location:'North Maclean',address:'North Maclean QLD',latitude:-27.76,longitude:153.01,locationAccuracy:10,locationCapturedAt:stamp(-2,-1),reading:3842,notes:'Hydraulic leak identified during sample inspection.',results:[{itemId:100,label:'General Condition',value:'pass'},{itemId:103,label:'Fluid Leaks',value:'fail'},{itemId:104,label:'Brakes / Controls',value:'pass'}],signature,status:'Failed',failedCount:1};
  const defect={id:'DEF-DEMO-001',assetId:'EX-0320',assetName:'CAT 320 Excavator',assetType:'Excavator',rego:'EX-0320',prestartId:failed.id,prestartItemId:103,defect:'Hydraulic oil leak at boom hose',reportedAt:failed.completedAt,reportedBy:'Jordan Lee',reading:3842,location:'North Maclean QLD',priority:'MEDIUM',status:'OPEN',action:'Workshop inspection required',resolutionNotes:'',updatedAt:failed.completedAt,resolvedAt:null,closedAt:null};
  operations.savePrestartWithDefects(failed,[defect]);
  operations.saveDefect({id:'DEF-DEMO-002',assetId:'LV-014',assetName:'Toyota Hilux',assetType:'Light Vehicle',rego:'LV-014',prestartId:'PS-DEMO-003',prestartItemId:101,defect:'Left rear work light intermittent',reportedAt:stamp(-18),reportedBy:'Alex Turner',reading:55480,location:'Gold Coast QLD',priority:'LOW',status:'RESOLVED',action:'Replaced lamp connector',resolutionNotes:'Tested and operating normally.',updatedAt:stamp(-15),resolvedAt:stamp(-15),closedAt:null});
}

function seedServices(){
  if(services.list().length)return;
  const base=r=>({serviceCentre:'Supervisor365 Demo Workshop',notes:'Sample build-stage service record',reminderDays:14,status:'SCHEDULED',createdAt:stamp(-20),updatedAt:stamp(-20),completedDate:null,completedReading:null,completionNotes:'',cancelledAt:null,...r});
  services.save(base({id:'SVC-DEMO-001',assetId:'SB-909',rego:'SB-909',assetName:'Kenworth T909',assetType:'Prime Mover',serviceType:'Truck B Service',requestedDate:day(5)}));
  services.save(base({id:'SVC-DEMO-002',assetId:'TRL-A01',rego:'TR-A01',assetName:'MaxiTRANS A Trailer',assetType:'A Trailer',serviceType:'Trailer B Service',requestedDate:day(22),reminderDays:30}));
  services.save(base({id:'SVC-DEMO-003',assetId:'EX-0320',rego:'EX-0320',assetName:'CAT 320 Excavator',assetType:'Excavator',serviceType:'Certificate of Inspection',requestedDate:day(-4),notes:'Sample overdue service item.'}));
  services.save(base({id:'SVC-DEMO-004',assetId:'LV-014',rego:'LV-014',assetName:'Toyota Hilux',assetType:'Light Vehicle',serviceType:'Truck A Service',requestedDate:day(-35),status:'COMPLETED',completedDate:day(-30),completedReading:55200,completionNotes:'Oil, filters and safety inspection completed.',updatedAt:stamp(-30)}));
}

function seedIncidents(){
  if(incidents.list().length)return;
  const base=r=>({trailers:[],thirdPartyInvolved:false,thirdPartyDetails:'',signature,images:[],documents:[],createdAt:stamp(-12),updatedAt:stamp(-12),status:'OPEN',...r});
  incidents.save(base({id:'INC-DEMO-001',vehicleId:'SB-909',vehicleRego:'SB-909',vehicleName:'Kenworth T909',vehicleType:'Prime Mover',employeeId:'EMP-DEMO-001',employeeName:'Alex Turner',employeePayrollIdentifier:'EMP001',incidentDate:day(-12),incidentTime:'10:35',weatherConditions:'Clear / Fine',incidentDescription:'Sample low-speed yard contact recorded for build-stage testing.',acknowledgementName:'Alex Turner',acknowledgementDate:day(-12),trailers:[{id:'TRL-A01',rego:'TR-A01',name:'MaxiTRANS A Trailer',type:'A Trailer'}]}));
  incidents.save(base({id:'INC-DEMO-002',vehicleId:'LV-014',vehicleRego:'LV-014',vehicleName:'Toyota Hilux',vehicleType:'Light Vehicle',employeeId:'EMP-DEMO-003',employeeName:'Casey Morgan',employeePayrollIdentifier:'EMP003',incidentDate:day(-48),incidentTime:'15:10',weatherConditions:'Light Rain',incidentDescription:'Sample windscreen stone-chip event. No injury and vehicle remained operational.',acknowledgementName:'Casey Morgan',acknowledgementDate:day(-48),status:'CLOSED',createdAt:stamp(-48),updatedAt:stamp(-45)}));
}

function recipient(employee,status,offsets={}){const sentAt=stamp(offsets.sent??-8);const openedAt=['OPENED','COMPLETED'].includes(status)?stamp(offsets.opened??-5):null;const completedAt=status==='COMPLETED'?stamp(offsets.completed??-3):null;return{employeeId:employee.id,employeeName:employee.firstName+' '+employee.lastName,email:employee.email||'',phone:employee.phone||'',token:token(),status,sentAt,openedAt,completedAt,lastResentAt:null,resendCount:0,updatedAt:completedAt||openedAt||sentAt}}
function seedCompliance(){
  if(compliance.list().length)return;
  const [alex,jordan,casey,taylor]=employees;
  if(!alex)return;
  compliance.save({id:'CMP-DEMO-001',subject:'Driver Fatigue & Break Management Update',category:'SAFETY PROCEDURE',priority:'HIGH',effectiveDate:day(-8),dueDate:day(5),mandatory:true,messageHtml:'<p>This sample compliance item demonstrates acknowledgement tracking. Review fatigue-management expectations and confirm understanding.</p><ul><li>Take required breaks</li><li>Report fatigue concerns</li><li>Do not operate when unfit for duty</li></ul>',documents:[{id:'DOC-DEMO-001',name:'Fatigue-Management-Sample.txt',type:'text/plain',size:77,data:'data:text/plain;base64,U3VwZXJ2aXNvcjM2NSBzYW1wbGUgZmF0aWd1ZSBtYW5hZ2VtZW50IGNvbXBsaWFuY2UgZG9jdW1lbnQu'}],videos:[],distributionMode:'all',employeeIds:employees.map(e=>e.id),recipients:[recipient(alex,'COMPLETED'),recipient(jordan,'OPENED'),recipient(casey,'SENT'),recipient(taylor,'SENT')],status:'ACTIVE',createdAt:stamp(-8),updatedAt:stamp(-8)});
  compliance.save({id:'CMP-DEMO-002',subject:'Weekly Yard Safety Toolbox Talk',category:'TOOLBOX TALK',priority:'MEDIUM',effectiveDate:day(-14),dueDate:day(-3),mandatory:true,messageHtml:'<p>Sample toolbox talk covering pedestrian separation, reversing awareness and exclusion zones.</p>',documents:[{id:'DOC-DEMO-002',name:'Yard-Safety-Toolbox-Sample.txt',type:'text/plain',size:69,data:'data:text/plain;base64,U3VwZXJ2aXNvcjM2NSBzYW1wbGUgeWFyZCBzYWZldHkgdG9vbGJveCB0YWxrLg=='}],videos:[],distributionMode:'selected',employeeIds:[alex.id,jordan.id,casey.id],recipients:[recipient(alex,'COMPLETED',{sent:-14,opened:-13,completed:-13}),recipient(jordan,'COMPLETED',{sent:-14,opened:-12,completed:-12}),recipient(casey,'SENT',{sent:-14})],status:'ACTIVE',createdAt:stamp(-14),updatedAt:stamp(-12)});
}

function seedDriverAssignment(){
  const asset=assets.find(a=>a.id==='SB-909'),employee=employees.find(e=>e.id==='EMP-DEMO-001'),prestart=operations.getPrestart('PS-DEMO-001');
  if(!asset||!employee||!prestart)return;
  asset.currentDriverEmployeeId=employee.id;asset.currentDriverName=employee.firstName+' '+employee.lastName;asset.currentDriverEmail=employee.email;asset.currentDriverPhone=employee.phone;asset.driverLatchedAt=prestart.completedAt;asset.driverPrestartId=prestart.id;asset.driverStationarySince='';asset.driverLastMovedAt=prestart.completedAt;asset.driverLastGpsAt='';asset.driverLastGpsLat=null;asset.driverLastGpsLon=null;asset.driverGpsState='assigned';
  employee.currentAssetId=asset.id;employee.currentAssetName=asset.name;employee.currentAssetRego=asset.rego;employee.currentAssetAssignedAt=prestart.completedAt;employee.currentPrestartId=prestart.id;
}

function reconcileAssetCounts(){
  const defects=operations.listDefects();
  for(const asset of assets)asset.openDefects=defects.filter(d=>String(d.assetId)===String(asset.id)&&!['RESOLVED','CLOSED'].includes(String(d.status||'').toUpperCase())).length;
}

function seed(){
  if(!enabled()){console.log('Supervisor365 sample data: disabled (SV365_SAMPLE_DATA=0)');return{enabled:false}}
  seedInMemory();seedOperations();seedServices();seedIncidents();seedCompliance();reconcileAssetCounts();seedDriverAssignment();
  const summary={assets:assets.length,employees:employees.length,prestarts:operations.listPrestarts().length,defects:operations.listDefects().length,services:services.list().length,incidents:incidents.list().length,compliance:compliance.list().length};
  console.log('Supervisor365 build sample data ready:',summary);
  return{enabled:true,...summary};
}

module.exports={seed,enabled};

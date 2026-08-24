const assetTypes=['Prime Mover','Rigid Truck','A Trailer','B Trailer','Dolly','Bus','Car','Motorcycle','Crane','Excavator','Front End Loader','Bulldozer','Loader','Elevated Work Platform','Forklift','Stump Grinder','Wood Chipper','Telehandler','Other','Light Vehicle','Semi Trailer'];

const baseAsset=(a)=>({
  registrationState:'QLD',registrationExpiry:'',vin:'',acquisitionDate:'',category:'',refrigerationInspectionDate:'',
  handbrakeAlarm:false,reverseCamera:false,adasVideo:false,insuranceExpiry:'',compliancePlateDate:'',
  coiNumber:'',coiDueDate:'',plantId:'',additionalNotes:'',location:'',serviceDue:false,openDefects:0,images:[],...a
});
const assets=[
baseAsset({id:'SB-909',name:'Kenworth T909',make:'Kenworth',model:'T909',type:'Prime Mover',rego:'SB-909',location:'North Maclean',status:'In Service',reading:84220}),
baseAsset({id:'TRL-A01',name:'MaxiTRANS A Trailer',make:'MaxiTRANS',model:'A Trailer',type:'A Trailer',rego:'TR-A01',location:'North Maclean',status:'In Service',reading:0}),
baseAsset({id:'TRL-B01',name:'MaxiTRANS B Trailer',make:'MaxiTRANS',model:'B Trailer',type:'B Trailer',rego:'TR-B01',location:'North Maclean',status:'In Service',reading:0}),
baseAsset({id:'DOL-01',name:'Haulmark Dolly',make:'Haulmark',model:'Dolly',type:'Dolly',rego:'DOL-01',location:'North Maclean',status:'In Service',reading:0}),
baseAsset({id:'EX-0320',name:'CAT 320 Excavator',make:'CAT',model:'320',type:'Excavator',rego:'EX-0320',location:'North Maclean',status:'Maintenance',serviceDue:true,openDefects:2,reading:3842}),
baseAsset({id:'LV-014',name:'Toyota Hilux',make:'Toyota',model:'Hilux',type:'Light Vehicle',rego:'LV-014',location:'Gold Coast',status:'In Service',serviceDue:true,openDefects:1,reading:56200})
];

const employees=[];
const pmLabels=['Odometer Reading','Inspection Date','Registration Plates Affixed and Legible','Compliance Plate Affixed','Park / Tail / Number Plate Lights','Head Lights','Brake Lights','Reflectors','Warning Devices / Indicators','Wipers / Washers','Glazing - Material / Visibility','Window Operation','Seat Mountings','Seat Belts - Fitting / Operation','Wheel Condition / Security','Wheel Bearings','Tyres - Tread Depth & Condition','Corrosion / Security / Damage','Doors / Bonnet / Catches','Rear Vision Mirrors','Rear Marker Plates','Body Fittings / Bumper Bars','Auto Tow Couplings','King Pin / Skid Plate','Tow Eye / Drawbar / Safety Chains','Ball Race Turntable','Goose Neck','Brake Components','Brake Operation','Steering Box / Pitman Arm','Steering Linkages / Arms','King Pins','Steering Free Play','Suspension Springs','Air Bags / Air Suspension','Shock Absorbers','Axles / Cross Members','Oil / Fuel Leaks','Steering Accessories','Exhaust System Leaks','Exhaust System Emissions','Engine Mountings','Transmission Mountings','Chassis Cracks','Chassis Corrosion','Mudflaps','Low Air Warning Devices','Air System Leaks','Breakaway Protection'];
const prestartItems=pmLabels.map((label,i)=>({id:i+1,assetType:'Prime Mover',label,name:'item'+(i+1),type:i===0?'Number':i===1?'Date':'Checkbox',element:'Input',dataType:i>1?'Boolean':'String',required:true,compulsory:false,daily:true,weekly:false,monthly:false,order:i+1}));
const genericItems=['General Condition','Lights / Warning Devices','Tyres / Tracks / Wheels','Fluid Leaks','Brakes / Controls','Safety Equipment'].map((label,i)=>({id:100+i,assetType:'Generic',label,name:'generic'+(i+1),type:'Checkbox',element:'Input',dataType:'Boolean',required:true,compulsory:false,daily:true,weekly:false,monthly:false,order:i+1}));
const prestartHistory=[];
module.exports={assetTypes,assets,employees,prestartItems,genericItems,prestartHistory};

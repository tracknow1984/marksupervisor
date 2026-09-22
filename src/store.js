const {collection}=require('./tenant-collections');
const assetTypes=collection('assetTypes',['Prime Mover','Rigid Truck','A Trailer','B Trailer','Dolly','Bus','Car','Motorcycle','Crane','Excavator','Front End Loader','Bulldozer','Loader','Elevated Work Platform','Forklift','Stump Grinder','Wood Chipper','Telehandler','Other','Light Vehicle','Semi Trailer']);

// Each worker has its own persisted collections; new companies start empty.
const assets=collection('assets');
const employees=collection('employees');

const pmLabels=['Odometer Reading','Inspection Date','Registration Plates Affixed and Legible','Compliance Plate Affixed','Park / Tail / Number Plate Lights','Head Lights','Brake Lights','Reflectors','Warning Devices / Indicators','Wipers / Washers','Glazing - Material / Visibility','Window Operation','Seat Mountings','Seat Belts - Fitting / Operation','Wheel Condition / Security','Wheel Bearings','Tyres - Tread Depth & Condition','Corrosion / Security / Damage','Doors / Bonnet / Catches','Rear Vision Mirrors','Rear Marker Plates','Body Fittings / Bumper Bars','Auto Tow Couplings','King Pin / Skid Plate','Tow Eye / Drawbar / Safety Chains','Ball Race Turntable','Goose Neck','Brake Components','Brake Operation','Steering Box / Pitman Arm','Steering Linkages / Arms','King Pins','Steering Free Play','Suspension Springs','Air Bags / Air Suspension','Shock Absorbers','Axles / Cross Members','Oil / Fuel Leaks','Steering Accessories','Exhaust System Leaks','Exhaust System Emissions','Engine Mountings','Transmission Mountings','Chassis Cracks','Chassis Corrosion','Mudflaps','Low Air Warning Devices','Air System Leaks','Breakaway Protection'];
const prestartItems=collection('prestartItems',pmLabels.map((label,i)=>({id:i+1,assetType:'Prime Mover',label,name:'item'+(i+1),type:i===0?'Number':i===1?'Date':'Checkbox',element:'Input',dataType:i>1?'Boolean':'String',required:true,compulsory:false,daily:true,weekly:false,monthly:false,order:i+1})));
const genericItems=collection('genericItems',['General Condition','Lights / Warning Devices','Tyres / Tracks / Wheels','Fluid Leaks','Brakes / Controls','Safety Equipment'].map((label,i)=>({id:100+i,assetType:'Generic',label,name:'generic'+(i+1),type:'Checkbox',element:'Input',dataType:'Boolean',required:true,compulsory:false,daily:true,weekly:false,monthly:false,order:i+1})));
const prestartHistory=collection('prestartHistory');
const vehicleDefects=collection('vehicleDefects');
module.exports={assetTypes,assets,employees,prestartItems,genericItems,prestartHistory,vehicleDefects};

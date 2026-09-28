const option=(value,label=value)=>({value,label});
const inspection=option('Certificate of Inspection');
const groups={
 truck:[option('Truck A Service','Truck A Service — 10,000 to 20,000 km'),option('Truck B Service','Truck B Service — 20,000 to 45,000 km'),option('Truck C Service','Truck C Service — 80,000 to 100,000 km'),inspection],
 machine:Array.from({length:40},(_,i)=>option(`Machine ${(i+1)*250} Hour Service`,`Machine Service — ${((i+1)*250).toLocaleString('en-AU')} hrs`)),
 car:[10000,...Array.from({length:10},(_,i)=>(i+1)*50000)].map(km=>option(`Car ${km} km Service`,`Car Service — ${km.toLocaleString('en-AU')} km`)),
 trailer:[option('Trailer B Service'),inspection],
 other:[option('General Service'),inspection]
};
function category(a){
 const t=String(a?.type||a?.category||'').toLowerCase();
 if(/trailer|dolly/.test(t))return 'trailer';
 if(/truck|prime mover|bus|tipper/.test(t))return 'truck';
 if(/car\b|light vehicle|ute\b|van\b|motorcycle|passenger/.test(t))return 'car';
 if(/machine|plant|excavator|loader|dozer|crane|forklift|roller|grader|telehandler|work platform|grinder|chipper|skid|bobcat|generator|screen|crusher|stacker|compactor/.test(t))return 'machine';
 return 'other';
}
const options=a=>a?groups[category(a)]:[];
const valid=(a,value)=>options(a).some(x=>x.value===value);
const label=value=>Object.values(groups).flat().find(x=>x.value===value)?.label||value;
module.exports={groups,category,options,valid,label};

(()=>{
 if(window.serviceTypesReady)return;window.serviceTypesReady=true;
 let configuration;
 const initialise=form=>{
  const asset=form.elements.vehicleId||form.elements.asset,type=form.elements.serviceType||form.elements.type;
  if(!asset||!type||type.tagName!=='SELECT'||type.dataset.dynamicService)return;
  type.dataset.dynamicService='1';const original=type.value;let first=true;
  const help=document.createElement('p');help.className='sub';help.setAttribute('role','status');type.after(help);
  function refresh(){
   const current=first?original:'';first=false;const config=configuration[String(asset.value)];
   const choices=config?.options||[];type.replaceChildren(new Option(asset.value?'Select Service Type':'Select an asset first',''));
   for(const choice of choices)type.add(new Option(choice.label,choice.value));
   if(current&&choices.some(x=>x.value===current))type.value=current;
   type.disabled=!config;type.required=true;
   help.textContent=config?config.category.charAt(0).toUpperCase()+config.category.slice(1)+' service options'+(config.category==='other'?' — set the asset type to show truck, machine, car or trailer intervals.':'.'):'';
   type.dispatchEvent(new Event('change',{bubbles:true}));
  }
  asset.addEventListener('change',refresh);form.addEventListener('reset',()=>queueMicrotask(refresh));refresh();
 };
 const scan=()=>{if(configuration)document.querySelectorAll('form').forEach(initialise)};
 fetch('/api/service-types'+(location.pathname==='/service/parts'?'?lists=1':''),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{configuration=data;scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true})}).catch(()=>{document.querySelectorAll('select[name="serviceType"],#parts-builder select[name="type"]').forEach(s=>{s.disabled=true;s.after(document.createTextNode('Unable to load service types. Refresh the page to retry.'))})});
})();

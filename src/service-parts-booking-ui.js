(() => {
  if(window.initServicePartsBooking)return;
  const initialise=form=>{
    const toggle=form.querySelector('[data-parts-required]');if(!toggle||toggle.dataset.ready)return;toggle.dataset.ready='1';
    const asset=form.elements.vehicleId,type=form.elements.serviceType,flag=form.elements.partsRequired,token=form.elements.partsConfirmation;
    const panel=form.querySelector('[data-parts-panel]'),message=form.querySelector('[data-parts-message]'),list=form.querySelector('[data-parts-list]'),confirm=form.querySelector('[data-parts-confirm]'),confirmRow=confirm.closest('label'),manage=form.querySelector('[data-parts-manage]');
    let sequence=0,ready=false,revision='';
    const money=n=>n==null?'Not set':Number(n).toLocaleString('en-AU',{style:'currency',currency:'AUD'});
    async function load(){
      const inspection=type.value==='Certificate of Inspection';
      toggle.disabled=inspection;toggle.closest('.field').hidden=inspection;
      if(inspection)toggle.checked=false;
      const request=++sequence;flag.value=toggle.checked?'true':'false';token.value='';confirm.checked=false;revision='';ready=false;list.replaceChildren();panel.hidden=!toggle.checked;confirmRow.hidden=true;confirm.required=false;
      manage.href='/service/parts?asset='+encodeURIComponent(asset.value)+'&type='+encodeURIComponent(type.value);
      if(!toggle.checked)return;
      if(!asset.value||!type.value){message.textContent='Select an asset and service type to check its saved parts.';return;}
      message.textContent='Checking saved parts…';
      try{
        const response=await fetch('/api/service-parts/preview?asset='+encodeURIComponent(asset.value)+'&type='+encodeURIComponent(type.value),{cache:'no-store'}),data=await response.json();
        if(request!==sequence)return;if(!response.ok)throw Error(data.error||'Unable to check saved parts.');
        ready=true;revision=data.revision;
        if(!data.parts.length){message.textContent='No parts list is saved for this asset and service type. You can create one now, or schedule with parts marked as awaiting allocation.';return;}
        message.textContent='Saved parts found. Review and confirm them for this service.';
        let total=0,missingCosts=false;for(const part of data.parts){const row=document.createElement('div');row.style.cssText='padding:8px 0;border-bottom:1px solid #e2e8f0';const cost=part.unitPrice==null?null:part.quantity*part.unitPrice;if(cost==null)missingCosts=true;else total+=cost;row.textContent=part.quantity+' '+part.unit+' · '+part.name+(part.sku?' ('+part.sku+')':'')+(part.partKind==='genuine'?' · Genuine':part.partKind==='non-genuine'?' · Non-genuine':'')+' · '+money(cost);list.append(row);}
        const summary=document.createElement('strong');summary.textContent='Estimated parts total: '+money(total)+(missingCosts?' (incomplete: costs not set)':'');list.append(summary);confirmRow.hidden=false;confirm.required=true;
      }catch(error){if(request===sequence){message.textContent=error.message+' Use Refresh parts to try again.';ready=false;}}
    }
    toggle.addEventListener('change',load);asset.addEventListener('change',load);type.addEventListener('change',load);
    confirm.addEventListener('change',()=>{token.value=confirm.checked?revision:''});
    form.querySelector('[data-parts-refresh]').addEventListener('click',load);
    form.addEventListener('submit',event=>{if(toggle.checked&&(!ready||(confirm.required&&!confirm.checked))){event.preventDefault();event.stopImmediatePropagation();message.textContent=!ready?'Check the saved parts before scheduling. Select an asset and service type, then click Refresh parts.':'Confirm the saved parts before scheduling.';}},true);
    form.addEventListener('reset',()=>queueMicrotask(load));load();
  };
  window.initServicePartsBooking=initialise;
  const scan=()=>document.querySelectorAll('form.serviceForm').forEach(initialise);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
})();

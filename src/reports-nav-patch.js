const express=require('express');

if(!express.response.__sv365ReportsNavPatched){
  express.response.__sv365ReportsNavPatched=true;
  const originalSend=express.response.send;
  const injection=String.raw`<script id="sv365ReportsNavV1">(()=>{
    function apply(){
      const groups=[...document.querySelectorAll('.smartGroup')];
      const fleet=groups.find(g=>String(g.querySelector('.smartNavLabel')?.textContent||'').trim()==='Fleet');
      if(!fleet)return false;
      const children=fleet.querySelector('.smartChildren');
      if(!children)return false;
      if(!children.querySelector('a[href="/reports"]')){
        const link=document.createElement('a');
        link.className='smartChild'+(location.pathname==='/reports'?' active':'');
        link.href='/reports';
        link.dataset.navLabel='Reports';
        link.innerHTML='<span>Reports</span>';
        const live=children.querySelector('a[href="/gps"]');
        if(live&&live.nextSibling)children.insertBefore(link,live.nextSibling);else children.appendChild(link);
        link.addEventListener('click',()=>{if(innerWidth<=800)document.getElementById('svSidebar')?.classList.remove('mobileOpen')});
      }
      if(location.pathname==='/reports'){
        groups.forEach(g=>g.classList.remove('current','open'));
        fleet.classList.add('current','open');
        localStorage.setItem('sv365.smartGroup','fleet');
      }
      return true;
    }
    if(!apply()){
      let tries=0;
      const timer=setInterval(()=>{tries++;if(apply()||tries>60)clearInterval(timer)},50);
    }
  })();</script>`;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('id="svSidebar"')&&!body.includes('sv365ReportsNavV1')&&body.includes('</body>'))body=body.replace('</body>',injection+'</body>');
    return originalSend.call(this,body);
  };
}

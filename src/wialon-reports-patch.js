const express=require('express');
const reportsRouter=require('./routes/wialon-reports');

// Chain the reports router into the application's first JSON middleware. This keeps the
// modular master file untouched while ensuring /reports and /api/wialon-reports/* are
// reached before the application's final 404 handler.
if(!express.__sv365WialonReportsJsonPatched){
  express.__sv365WialonReportsJsonPatched=true;
  const originalJson=express.json;
  express.json=function(...args){
    const parser=originalJson(...args);
    return function sv365JsonWithWialonReports(req,res,next){
      parser(req,res,err=>err?next(err):reportsRouter(req,res,next));
    };
  };
}

// Add Reports under Fleet after the smart navigation has transformed the sidebar.
if(!express.response.__sv365WialonReportsNavPatched){
  express.response.__sv365WialonReportsNavPatched=true;
  const originalSend=express.response.send;
  const navScript=String.raw`<script id="svWialonReportsNav">(()=>{let done=false;function apply(){if(done||document.querySelector('.smartChild[href="/reports"]')){done=true;return true}const groups=[...document.querySelectorAll('.smartGroup')],fleet=groups.find(g=>String(g.querySelector('.smartNavLabel')?.textContent||'').trim()==='Fleet');if(!fleet)return false;const children=fleet.querySelector('.smartChildren');if(!children)return false;const a=document.createElement('a');a.className='smartChild'+(location.pathname==='/reports'?' active':'');a.href='/reports';a.innerHTML='<span>Reports</span>';children.appendChild(a);if(location.pathname==='/reports'){groups.forEach(g=>g.classList.remove('current','open'));fleet.classList.add('current','open');try{localStorage.setItem('sv365.smartGroup','fleet')}catch{}}done=true;return true}if(!apply()){const obs=new MutationObserver(()=>{if(apply())obs.disconnect()});obs.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{apply();obs.disconnect()},3000)}})();</script>`;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('</body>')&&!body.includes('svWialonReportsNav'))body=body.replace('</body>',navScript+'</body>');
    return originalSend.call(this,body);
  };
}

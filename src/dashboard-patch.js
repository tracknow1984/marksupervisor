const express=require('express');
const dashboardRouter=require('./routes/dashboard');

// Mount the dashboard ahead of app-master without disturbing the existing modular route stack.
// This also makes the root URL land on the owner/operations command centre.
const rootRouter=express.Router();
rootRouter.get('/',(req,res)=>res.redirect('/dashboard'));
rootRouter.use(dashboardRouter);

if(!express.__sv365DashboardJsonPatched){
  express.__sv365DashboardJsonPatched=true;
  const originalJson=express.json;
  express.json=function(...args){
    const parser=originalJson(...args);
    return function sv365JsonWithDashboard(req,res,next){
      parser(req,res,err=>err?next(err):rootRouter(req,res,next));
    };
  };
}

// Promote Dashboard to the permanent top navigation destination and put Assets back under Fleet.
if(!express.response.__sv365DashboardNavPatched){
  express.response.__sv365DashboardNavPatched=true;
  const originalSend=express.response.send;
  const navScript=String.raw`<script id="svDashboardNav">(()=>{let done=false;function apply(){const home=document.querySelector('.smartHome');if(!home)return false;home.href='/dashboard';home.dataset.navLabel='Dashboard';const label=home.querySelector('.smartNavLabel');if(label)label.textContent='Dashboard';home.classList.toggle('active',location.pathname==='/dashboard'||location.pathname==='/');const groups=[...document.querySelectorAll('.smartGroup')],fleet=groups.find(g=>String(g.querySelector('.smartNavLabel')?.textContent||'').trim()==='Fleet');if(fleet){const children=fleet.querySelector('.smartChildren');if(children&&!children.querySelector('a[href="/assets"]')){const a=document.createElement('a');a.href='/assets';a.className='smartChild'+(location.pathname==='/assets'?' active':'');a.dataset.navLabel='Assets';a.innerHTML='<span>Assets</span>';children.prepend(a)}if(location.pathname==='/assets'){groups.forEach(g=>g.classList.remove('current','open'));fleet.classList.add('current','open');try{localStorage.setItem('sv365.smartGroup','fleet')}catch{}}}done=true;return true}if(!apply()){const o=new MutationObserver(()=>{if(apply())o.disconnect()});o.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{apply();o.disconnect()},4000)}})();</script>`;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('</body>')&&!body.includes('svDashboardNav'))body=body.replace('</body>',navScript+'</body>');
    return originalSend.call(this,body);
  };
}

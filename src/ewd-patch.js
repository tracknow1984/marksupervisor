const express=require('express');
const ewdRouter=require('./routes/ewd');

// Mount EWD ahead of app-master so the new driver/compliance routes share the existing app shell.
if(!express.__sv365EwdJsonPatched){
  express.__sv365EwdJsonPatched=true;
  const previousJson=express.json;
  express.json=function(...args){
    const parser=previousJson(...args);
    return function sv365JsonWithEwd(req,res,next){
      parser(req,res,err=>err?next(err):ewdRouter(req,res,next));
    };
  };
}

// Place EWD directly after Pre-Starts in the Operations group of the smart navigation.
if(!express.response.__sv365EwdNavPatched){
  express.response.__sv365EwdNavPatched=true;
  const originalSend=express.response.send;
  const script=String.raw`<script id="sv365EwdNav">(()=>{function apply(){const groups=[...document.querySelectorAll('.smartGroup')],ops=groups.find(g=>String(g.querySelector('.smartNavLabel')?.textContent||'').trim()==='Operations');if(!ops)return false;const children=ops.querySelector('.smartChildren');if(!children)return false;if(!children.querySelector('a[href="/ewd"]')){const pre=children.querySelector('a[href="/prestarts"]'),a=document.createElement('a');a.href='/ewd';a.className='smartChild'+(location.pathname.startsWith('/ewd')?' active':'');a.dataset.navLabel='EWD';a.dataset.navHref='/ewd';a.innerHTML='<span style="display:flex;align-items:center;gap:7px"><svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2M7 3l-2 2M17 3l2 2"/></svg><span>Electronic Work Diary</span></span><span class="smartBadge">EWD</span>';if(pre)pre.insertAdjacentElement('afterend',a);else children.prepend(a)}if(location.pathname.startsWith('/ewd')){groups.forEach(g=>g.classList.remove('current','open'));ops.classList.add('current','open');try{localStorage.setItem('sv365.smartGroup','operations')}catch{}}return true}if(!apply()){const o=new MutationObserver(()=>{if(apply())o.disconnect()});o.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{apply();o.disconnect()},5000)}})();</script>`;
  express.response.send=function(body){if(typeof body==='string'&&body.includes('</body>')&&!body.includes('sv365EwdNav'))body=body.replace('</body>',script+'</body>');return originalSend.call(this,body)};
}

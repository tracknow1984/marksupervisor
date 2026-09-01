const express=require('express');
const moduleStore=require('./module-store');

if(!express.response.__sv365ModuleNavigationPatched){
  express.response.__sv365ModuleNavigationPatched=true;
  const originalSend=express.response.send;
  const routeMap=JSON.stringify(moduleStore.routeMap()).replace(/</g,'\\u003c');
  const style=`<style id="sv365ModuleNavStyle">.smartModuleStore{margin-bottom:8px!important}.smartModuleStore.active{background:linear-gradient(145deg,rgba(31,166,219,.20),rgba(43,121,211,.12))!important;color:#46c7f3!important;box-shadow:inset 0 0 0 1px rgba(59,197,241,.17)}.smartModuleStore .smartNavIcon svg{width:21px;height:21px}</style>`;
  const script=`<script id="sv365ModuleNavigation">(()=>{const routeMap=${routeMap};let state=null;const normalise=href=>{try{return new URL(href,location.origin).pathname.replace(/\\/$/,'')||'/'}catch{return String(href||'').split('?')[0].replace(/\\/$/,'')||'/'}};function moduleFor(href){const path=normalise(href);for(const [id,routes] of Object.entries(routeMap))if(routes.some(route=>path===route||path.startsWith(route+'/')))return id;return''}function allowed(href){const id=moduleFor(href);return!id||!!state?.enabledIds?.includes(id)}function display(el,on){const value=on?'':'none';if(el.style.display!==value)el.style.display=value}function ensureStore(nav){let link=nav.querySelector('.smartModuleStore');if(link)return link;const home=nav.querySelector('.smartHome');if(!home)return null;link=document.createElement('a');link.className='smartHome smartModuleStore'+(location.pathname==='/modules'?' active':'');link.href='/modules';link.dataset.navLabel='Modules Store';link.innerHTML='<span class="smartNavIcon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16l-1.5 9h-13L4 7Z"/><path d="M8 7a4 4 0 0 1 8 0M8 20h.01M16 20h.01"/></svg></span><span class="smartNavLabel smartReveal">Modules Store</span>';home.insertAdjacentElement('afterend',link);return link}function apply(){if(!state)return;const nav=document.querySelector('#svSidebar .smartNavBody');if(nav){ensureStore(nav);nav.querySelectorAll('.smartChild[href]').forEach(a=>display(a,allowed(a.getAttribute('href'))));nav.querySelectorAll('.smartGroup').forEach(group=>{const visible=[...group.querySelectorAll('.smartChild[href]')].some(a=>a.style.display!=='none');display(group,visible)})}document.querySelectorAll('#smartResults .smartResult[href]').forEach(a=>display(a,allowed(a.getAttribute('href'))))}window.sv365ApplyModules=data=>{state=data;apply()};new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});fetch('/api/modules',{cache:'no-store'}).then(r=>r.json()).then(data=>{state=data;apply()}).catch(()=>{})})();</script>`;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('id="svSidebar"')&&!body.includes('sv365ModuleNavigation')){
      if(body.includes('</head>'))body=body.replace('</head>',style+'</head>');
      if(body.includes('</body>'))body=body.replace('</body>',script+'</body>');
    }
    return originalSend.call(this,body);
  };
}

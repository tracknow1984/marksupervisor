const express=require('express');

if(!express.response.__sv365SmartNavPatched){
  express.response.__sv365SmartNavPatched=true;
  const originalSend=express.response.send;

  const style=String.raw`
<style id="svSmartNavStyle">
@media(min-width:801px){
  .side.smartNav{width:78px;overflow:hidden;transition:width .19s ease,box-shadow .19s ease;box-shadow:10px 0 30px rgba(15,23,42,.08)}
  .side.smartNav:hover,.side.smartNav.pinned{width:270px;box-shadow:18px 0 40px rgba(3,10,20,.22)}
  .side.smartNav .smartReveal{opacity:0;visibility:hidden;transform:translateX(-5px);transition:.13s ease;white-space:nowrap}
  .side.smartNav:hover .smartReveal,.side.smartNav.pinned .smartReveal{opacity:1;visibility:visible;transform:none}
  .side.smartNav .smartChildren{display:none}
  .side.smartNav:hover .smartGroup.open .smartChildren,.side.smartNav.pinned .smartGroup.open .smartChildren{display:grid}
  .side.smartNav .tip{display:none!important}
}
.side.smartNav{background:linear-gradient(180deg,#0a111b 0%,#0c1522 100%);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
.smartHead{height:72px;display:flex;align-items:center;padding:0 16px;gap:12px;border-bottom:1px solid rgba(255,255,255,.06);position:relative;flex:0 0 72px}
.smartBrandMark{width:44px;height:44px;border:1px solid rgba(55,199,242,.42);border-radius:14px;display:grid;place-items:center;color:#35c8f3;background:linear-gradient(145deg,#122031,#0b141f);font-weight:900;font-size:12px;letter-spacing:-.5px;box-shadow:0 8px 20px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.04);flex:0 0 44px}
.smartBrandText{min-width:0}.smartBrandText b{display:block;color:#f2f6fa;font-size:14px;letter-spacing:.1px}.smartBrandText span{display:block;color:#65758a;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.smartPin{margin-left:auto;width:30px;height:30px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:#8494a9;border-radius:8px;display:grid;place-items:center;cursor:pointer;flex:0 0 30px}.smartPin:hover{color:#fff;background:rgba(255,255,255,.07)}.smartPin svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8}
.smartNavBody{padding:12px 9px 14px;overflow:auto;overflow-x:hidden;flex:1;scrollbar-width:none}.smartNavBody::-webkit-scrollbar{display:none}
.smartQuick{width:58px;height:42px;margin:0 auto 11px;border:1px solid rgba(54,198,242,.24);background:linear-gradient(145deg,rgba(34,163,211,.18),rgba(37,119,227,.13));color:#45c8f3;border-radius:12px;display:flex;align-items:center;gap:11px;padding:0 17px;cursor:pointer;overflow:hidden;font-weight:850;transition:.15s ease}.side.smartNav:hover .smartQuick,.side.smartNav.pinned .smartQuick{width:248px;margin-left:1px;margin-right:1px}.smartQuick:hover{background:linear-gradient(145deg,rgba(34,163,211,.25),rgba(37,119,227,.20));color:#79dcfa}.smartQuickIcon{font-size:23px;line-height:1;flex:0 0 22px;text-align:center}.smartQuickText{font-size:10px;letter-spacing:.75px;text-transform:uppercase}
.smartHome,.smartGroupButton,.smartChild{border:0;text-decoration:none;background:transparent;color:#8795a8;cursor:pointer}
.smartHome{height:46px;width:58px;margin:0 auto 8px;border-radius:12px;display:flex;align-items:center;gap:12px;padding:0 18px;position:relative;overflow:hidden}.side.smartNav:hover .smartHome,.side.smartNav.pinned .smartHome{width:248px;margin-left:1px;margin-right:1px}.smartHome:hover,.smartHome.active{background:rgba(255,255,255,.06);color:#f5f9ff}.smartHome.active{color:#46c7f3;box-shadow:inset 0 0 0 1px rgba(59,197,241,.13)}
.smartGroup{margin:5px 0}.smartGroupButton{height:46px;width:58px;margin:0 auto;border-radius:12px;display:flex;align-items:center;gap:12px;padding:0 18px;position:relative;overflow:hidden}.side.smartNav:hover .smartGroupButton,.side.smartNav.pinned .smartGroupButton{width:248px;margin-left:1px;margin-right:1px}.smartGroupButton:hover,.smartGroup.current .smartGroupButton{background:rgba(255,255,255,.055);color:#eef5fb}.smartGroup.current .smartGroupButton{color:#45c9f4}
.smartNavIcon{width:22px;height:22px;display:grid;place-items:center;flex:0 0 22px}.smartNavIcon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}.smartNavLabel{font-size:10px;font-weight:850;letter-spacing:.75px;text-transform:uppercase;min-width:0;flex:1;text-align:left}.smartChevron{width:15px;height:15px;transition:transform .15s}.smartGroup.open .smartChevron{transform:rotate(90deg)}
.smartChildren{gap:2px;margin:3px 0 7px 46px;padding-left:10px;border-left:1px solid rgba(255,255,255,.075)}.smartChild{min-height:34px;border-radius:8px;padding:8px 9px;display:flex;align-items:center;justify-content:space-between;gap:9px;font-size:9.5px;font-weight:760;letter-spacing:.48px;text-transform:uppercase;text-align:left}.smartChild:hover{background:rgba(255,255,255,.055);color:#f4f8fb}.smartChild.active{background:rgba(46,153,211,.12);color:#4bcdf5}.smartChildMain{display:flex;align-items:center;gap:7px;min-width:0}.smartChildIcon{width:16px;height:16px;display:grid;place-items:center;flex:0 0 16px;color:#4bcdf5}.smartChildIcon svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.smartBadge{display:none;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#24344a;color:#b9c6d5;font-size:9px;font-weight:900;align-items:center;justify-content:center}.smartBadge.show{display:inline-flex}.smartBadge.alert{background:#5b2727;color:#ffd5d5}.smartBadge.warn{background:#4a3a1f;color:#ffe1a8}
.smartSectionLine{height:1px;background:rgba(255,255,255,.055);margin:10px 9px}
.side.smartNav .sidefoot{padding:10px 9px 14px}.side.smartNav .profileWrap,.side.smartNav .buildWrap{width:58px;margin:auto;transition:width .15s}.side.smartNav:hover .profileWrap,.side.smartNav:hover .buildWrap,.side.smartNav.pinned .profileWrap,.side.smartNav.pinned .buildWrap{width:248px}.side.smartNav .profileIcon,.side.smartNav .buildDot{margin:0;width:46px;flex:0 0 46px}.smartFootRow{display:flex;align-items:center;gap:11px;overflow:hidden}.smartFootCopy b{display:block;color:#cdd7e2;font-size:10px}.smartFootCopy span{color:#65758a;font-size:9px}.side.smartNav .buildDot{height:30px}.smartBuildText{font-size:9px;color:#77879b}
.smartOverlay{position:fixed;inset:0;background:rgba(4,11,20,.68);z-index:1100;display:none;align-items:flex-start;justify-content:center;padding:13vh 18px 30px}.smartOverlay.open{display:flex}.smartPalette{width:min(700px,96vw);background:#fff;border:1px solid #dfe5ec;border-radius:16px;box-shadow:0 35px 90px rgba(0,0,0,.35);overflow:hidden}.smartPaletteHead{padding:16px;border-bottom:1px solid #e8edf2}.smartSearchWrap{display:flex;align-items:center;gap:10px;border:1px solid #d7e0e9;border-radius:11px;padding:10px 12px;background:#fbfcfd}.smartSearchWrap svg{width:18px;height:18px;fill:none;stroke:#738196;stroke-width:1.8}.smartSearch{border:0!important;outline:0!important;background:transparent!important;padding:0!important;font-size:14px;flex:1}.smartResults{max-height:430px;overflow:auto;padding:8px}.smartResult{width:100%;border:0;background:#fff;border-radius:10px;padding:11px 12px;display:flex;align-items:center;gap:12px;text-decoration:none;color:#27364a;text-align:left;cursor:pointer}.smartResult:hover,.smartResult.selected{background:#f0f6fc}.smartResultIcon{width:34px;height:34px;border-radius:9px;background:#edf4fb;color:#2678c9;display:grid;place-items:center;font-size:16px;flex:0 0 34px}.smartResultText{min-width:0;flex:1}.smartResultText b{font-size:12px;display:block}.smartResultText span{font-size:10px;color:#8591a1;display:block;margin-top:2px}.smartKey{font-size:9px;border:1px solid #dde4eb;background:#fafbfc;color:#7a8797;border-radius:6px;padding:3px 5px}.smartPaletteFoot{border-top:1px solid #edf1f5;padding:9px 13px;color:#8a96a7;font-size:9px;display:flex;justify-content:space-between}
@media(max-width:800px){
  .side.smartNav{width:282px!important;overflow:hidden}.side.smartNav .smartReveal{opacity:1;visibility:visible;transform:none}.side.smartNav .smartChildren{display:none}.side.smartNav .smartGroup.open .smartChildren{display:grid}.smartHead{padding-left:15px}.smartPin{display:none}.smartQuick,.smartHome,.smartGroupButton{width:260px!important;margin-left:1px!important;margin-right:1px!important}.side.smartNav .profileWrap,.side.smartNav .buildWrap{width:260px}.smartOverlay{padding-top:8vh}.smartPalette{width:100%}
}
</style>`;

  const script=String.raw`
<script id="svSmartNavV1">
(()=>{
  const side=document.getElementById('svSidebar');
  if(!side||side.dataset.smartReady==='1')return;
  side.dataset.smartReady='1';side.classList.add('smartNav');
  const path=location.pathname.replace(/\/$/,'')||'/';
  const icons={
    home:'<svg viewBox="0 0 24 24"><path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4z"/></svg>',
    modules:'<svg viewBox="0 0 24 24"><path d="M4 7h16l-1.5 9h-13L4 7Z"/><path d="M8 7a4 4 0 0 1 8 0M8 20h.01M16 20h.01"/></svg>',
    operations:'<svg viewBox="0 0 24 24"><path d="M4 7h16v12H4z"/><path d="M8 7V4h8v3M8 12h8M8 16h5"/></svg>',
    ewdOverview:'<svg viewBox="0 0 24 24"><path d="M4 5h16v12H4z"/><path d="M8 21h8M12 17v4M7 13l3-3 2 2 4-5"/></svg>',
    ewd:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2M7 3 5 5M17 3l2 2"/></svg>',
    fleet:'<svg viewBox="0 0 24 24"><path d="M4 16V10a2 2 0 0 1 2-2h10l4 4v4"/><path d="M3 16h18v3H3z"/><circle cx="7" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>',
    safety:'<svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6z"/><path d="m9 12 2 2 4-5"/></svg>',
    people:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 15.5a4.5 4.5 0 0 1 6.5 4"/></svg>',
    admin:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5L9 6.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2.1 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.5 3.1h5l.5-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.5a7 7 0 0 0 0-1z"/></svg>',
    chevron:'<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
    pin:'<svg viewBox="0 0 24 24"><path d="M8 3h8l-1 6 3 3v2H6v-2l3-3zM12 14v7"/></svg>'
  };
  const groups=[
    {id:'operations',label:'Operations',icon:icons.operations,items:[
      {label:'Pre-Starts',href:'/prestarts',desc:'Start and manage inspections'},
      {label:'EWD Overview',href:'/ewd-overview',desc:'Monitor active fatigue, work and rest',icon:icons.ewdOverview,badge:'ewdAttention'},
      {label:'Electronic Work Diary',href:'/ewd',desc:'Driver work, rest and fatigue management',icon:icons.ewd},
      {label:'Vehicle Defects',href:'/vehicle-defects',desc:'Open defects and maintenance',badge:'defects'},
      {label:'Service Schedule',href:'/service',desc:'Upcoming fleet servicing',badge:'services'}
    ]},
    {id:'fleet',label:'Fleet',icon:icons.fleet,items:[
      {label:'Live GPS',href:'/gps',desc:'Tracked assets and geofences'},
      {label:'Service History',href:'/service-history',desc:'Completed servicing records'}
    ]},
    {id:'safety',label:'Safety & Compliance',icon:icons.safety,items:[
      {label:'Compliance',href:'/compliance',desc:'Documents and acknowledgements',badge:'compliance'},
      {label:'Incident Register',href:'/incident-register',desc:'Safety and incident records'},
      {label:'Pre-Start History',href:'/prestart-history',desc:'Inspection audit history'}
    ]},
    {id:'people',label:'People',icon:icons.people,items:[
      {label:'Employees',href:'/employees',desc:'Staff profiles and health checks',badge:'people'}
    ]},
    {id:'admin',label:'Administration',icon:icons.admin,items:[
      {label:'Pre-Start Configuration',href:'/prestart-config',desc:'Checklist configuration'},
      {label:'GPS Integration',href:'/gps-integration',desc:'Wialon connection and linking'}
    ]}
  ];
  const activeFor=href=>href==='/incident-register'?path.startsWith('/incident-register'):path===href||path.startsWith(href+'/');
  let currentGroup=groups.find(g=>g.items.some(i=>activeFor(i.href)))?.id||localStorage.getItem('sv365.smartGroup')||'operations';
  const oldHead=side.querySelector('.sidehead');
  if(oldHead)oldHead.outerHTML='<div class="smartHead"><div class="smartBrandMark">S365</div><div class="smartBrandText smartReveal"><b>Supervisor365</b><span>Operations Platform</span></div><button type="button" class="smartPin smartReveal" id="smartPin" title="Pin navigation">'+icons.pin+'</button></div>';
  const nav=side.querySelector('.nav');
  if(!nav)return;
  nav.className='smartNavBody';
  const groupHtml=groups.map(g=>'<div class="smartGroup '+(g.id===currentGroup?'open ':'')+(g.items.some(i=>activeFor(i.href))?'current':'')+'" data-smart-group="'+g.id+'"><button type="button" class="smartGroupButton"><span class="smartNavIcon">'+g.icon+'</span><span class="smartNavLabel smartReveal">'+g.label+'</span><span class="smartBadge smartReveal" data-group-badge="'+g.id+'"></span><span class="smartChevron smartReveal">'+icons.chevron+'</span></button><div class="smartChildren smartReveal">'+g.items.map(i=>'<a class="smartChild '+(activeFor(i.href)?'active':'')+'" href="'+i.href+'" data-nav-label="'+i.label+'"><span class="smartChildMain">'+(i.icon?'<span class="smartChildIcon">'+i.icon+'</span>':'')+'<span>'+i.label+'</span></span>'+(i.badge?'<span class="smartBadge" data-badge="'+i.badge+'"></span>':'')+'</a>').join('')+'</div></div>').join('');
  nav.innerHTML='<button type="button" class="smartQuick" id="smartQuick"><span class="smartQuickIcon">+</span><span class="smartQuickText smartReveal">Quick Action</span></button><a class="smartHome '+((path==='/assets'||path==='/')?'active':'')+'" href="/assets" data-nav-label="Home"><span class="smartNavIcon">'+icons.home+'</span><span class="smartNavLabel smartReveal">Home</span></a><a class="smartHome smartModuleStore '+(path==='/modules'?'active':'')+'" href="/modules" data-nav-label="Modules Store"><span class="smartNavIcon">'+icons.modules+'</span><span class="smartNavLabel smartReveal">Modules Store</span></a><div class="smartSectionLine"></div>'+groupHtml;
  let moduleState=null;
  const modulePath=href=>{try{return new URL(href,location.origin).pathname.replace(/\/$/,'')||'/'}catch{return String(href||'').split('?')[0].replace(/\/$/,'')||'/'}};
  function moduleForHref(href){const pathname=modulePath(href);for(const item of moduleState?.items||[])if((item.routes||[]).some(route=>pathname===route||pathname.startsWith(route+'/')))return item.id;return''}
  function moduleAllowed(href){const id=moduleForHref(href);return!id||!!moduleState?.enabledIds?.includes(id)}
  function setModuleDisplay(el,on){const value=on?'':'none';if(el.style.display!==value)el.style.display=value}
  function applyModuleNavigation(data){moduleState=data||moduleState;if(!moduleState)return;nav.querySelectorAll('.smartChild[href]').forEach(link=>setModuleDisplay(link,moduleAllowed(link.getAttribute('href'))));nav.querySelectorAll('.smartGroup').forEach(group=>setModuleDisplay(group,[...group.querySelectorAll('.smartChild[href]')].some(link=>link.style.display!=='none')));if(document.getElementById('smartOverlay')?.classList.contains('open'))renderResults()}
  window.sv365ApplyModules=applyModuleNavigation;
  new MutationObserver(()=>applyModuleNavigation()).observe(nav,{childList:true,subtree:true});
  fetch('/api/modules',{cache:'no-store'}).then(r=>r.json()).then(applyModuleNavigation).catch(()=>{});

  const pin=document.getElementById('smartPin');
  const pinned=localStorage.getItem('sv365.smartPinned')==='1';if(pinned)side.classList.add('pinned');
  if(pin)pin.onclick=()=>{side.classList.toggle('pinned');localStorage.setItem('sv365.smartPinned',side.classList.contains('pinned')?'1':'0')};
  nav.querySelectorAll('.smartGroupButton').forEach(btn=>btn.onclick=()=>{const group=btn.closest('.smartGroup'),id=group.dataset.smartGroup;nav.querySelectorAll('.smartGroup').forEach(x=>x.classList.toggle('open',x===group&&!x.classList.contains('open')));if(!group.classList.contains('open')){group.classList.add('open')}currentGroup=id;localStorage.setItem('sv365.smartGroup',id)});
  const foot=side.querySelector('.sidefoot');
  if(foot){const profile=foot.querySelector('.profileWrap'),build=foot.querySelector('.buildWrap');if(profile)profile.innerHTML='<div class="smartFootRow"><div class="profileIcon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg></div><div class="smartFootCopy smartReveal"><b>Administrator</b><span>Account & role</span></div></div>';if(build){const dot=build.querySelector('.buildDot'),buildText=dot?dot.textContent:'';build.innerHTML='<div class="smartFootRow"><div class="buildDot">'+buildText+'</div><div class="smartFootCopy smartReveal"><b>Current Build</b><span class="smartBuildText">'+buildText+'</span></div></div>'}}

  const actions=[
    {label:'Start Pre-Start',href:'/prestarts',desc:'Begin a vehicle or asset inspection',icon:'✓'},
    {label:'EWD Overview',href:'/ewd-overview',desc:'Monitor all active work, rest and fatigue',icon:'▦'},
    {label:'Open Electronic Work Diary',href:'/ewd',desc:'Resume or start driver work and rest recording',icon:'◴'},
    {label:'Add Asset',href:'/assets?quick=addAsset',desc:'Create a new fleet asset',icon:'＋'},
    {label:'Add Employee',href:'/employees?quick=addEmployee',desc:'Create a staff profile',icon:'👤'},
    {label:'New Compliance Document',href:'/compliance?quick=newCompliance',desc:'Distribute a new compliance item',icon:'✓'},
    {label:'Report Incident',href:'/incident-register/new',desc:'Create a new incident record',icon:'!'},
    {label:'Schedule Service',href:'/service',desc:'Book upcoming maintenance',icon:'🔧'},
    {label:'Live GPS',href:'/gps',desc:'Open fleet tracking',icon:'⌖'},
    {label:'Share Live Location',href:'/gps?quick=shareLocation',desc:'Create a temporary external tracking link',icon:'↗'}
  ];
  const destinations=[
    {label:'Assets',href:'/assets',desc:'Fleet asset register'},
    {label:'Employees',href:'/employees',desc:'People and staff health checks'},
    {label:'Pre-Starts',href:'/prestarts',desc:'Daily inspections'},
    {label:'EWD Overview',href:'/ewd-overview',desc:'Live fatigue and break monitoring'},
    {label:'Electronic Work Diary',href:'/ewd',desc:'Driver work, rest and fatigue management'},
    {label:'Vehicle Defects',href:'/vehicle-defects',desc:'Defects and maintenance actions'},
    {label:'Service Schedule',href:'/service',desc:'Upcoming servicing'},
    {label:'Live GPS',href:'/gps',desc:'Wialon tracking'},
    {label:'Compliance',href:'/compliance',desc:'Compliance documents and register'},
    {label:'Incident Register',href:'/incident-register',desc:'Incident management'},
    {label:'Pre-Start History',href:'/prestart-history',desc:'Inspection audit history'},
    {label:'Service History',href:'/service-history',desc:'Completed maintenance'},
    {label:'Pre-Start Configuration',href:'/prestart-config',desc:'Inspection settings'},
    {label:'GPS Integration',href:'/gps-integration',desc:'Wialon configuration'}
  ];
  const overlay=document.createElement('div');overlay.className='smartOverlay';overlay.id='smartOverlay';overlay.innerHTML='<div class="smartPalette" role="dialog" aria-modal="true"><div class="smartPaletteHead"><div class="smartSearchWrap"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/></svg><input class="smartSearch" id="smartSearch" placeholder="Search pages or quick actions…" autocomplete="off"><span class="smartKey">ESC</span></div></div><div class="smartResults" id="smartResults"></div><div class="smartPaletteFoot"><span>↑ ↓ navigate · Enter open</span><span>Ctrl / ⌘ + K</span></div></div>';document.body.appendChild(overlay);
  const search=document.getElementById('smartSearch'),results=document.getElementById('smartResults');let resultRows=[],selected=0;
  function resultHtml(row,i){return '<a class="smartResult '+(i===selected?'selected':'')+'" href="'+row.href+'" data-result-index="'+i+'"><span class="smartResultIcon">'+(row.icon||'→')+'</span><span class="smartResultText"><b>'+row.label+'</b><span>'+row.desc+'</span></span></a>'}
  function renderResults(){const q=(search.value||'').trim().toLowerCase(),pool=q?[...actions,...destinations]:actions;resultRows=pool.filter(x=>moduleAllowed(x.href)&&(!q||((x.label+' '+x.desc).toLowerCase().includes(q)))).slice(0,12);selected=Math.min(selected,Math.max(0,resultRows.length-1));results.innerHTML=resultRows.length?resultRows.map(resultHtml).join(''):'<div style="padding:24px;text-align:center;color:#8793a3;font-size:12px">No matching pages or actions.</div>'}
  function openPalette(){overlay.classList.add('open');search.value='';selected=0;renderResults();setTimeout(()=>search.focus(),30)}function closePalette(){overlay.classList.remove('open')}
  document.getElementById('smartQuick').onclick=openPalette;overlay.onclick=e=>{if(e.target===overlay)closePalette()};search.oninput=()=>{selected=0;renderResults()};search.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();selected=Math.min(selected+1,resultRows.length-1);renderResults()}else if(e.key==='ArrowUp'){e.preventDefault();selected=Math.max(0,selected-1);renderResults()}else if(e.key==='Enter'&&resultRows[selected]){location.href=resultRows[selected].href}else if(e.key==='Escape')closePalette()};document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette()}else if(e.key==='Escape'&&overlay.classList.contains('open'))closePalette()});
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{if(innerWidth<=800)side.classList.remove('mobileOpen')}));

  function setBadge(key,value,tone){const n=Math.max(0,Number(value)||0);document.querySelectorAll('[data-badge="'+key+'"]').forEach(el=>{el.textContent=n>99?'99+':String(n);el.classList.toggle('show',n>0);el.classList.toggle('alert',tone==='alert'&&n>0);el.classList.toggle('warn',tone==='warn'&&n>0)})}
  function setGroupBadge(group,value,tone){const el=document.querySelector('[data-group-badge="'+group+'"]'),n=Math.max(0,Number(value)||0);if(!el)return;el.textContent=n>99?'99+':String(n);el.classList.toggle('show',n>0);el.classList.toggle('alert',tone==='alert'&&n>0);el.classList.toggle('warn',tone==='warn'&&n>0)}
  async function loadBadges(){let defects=0,services=0,cmp=0,people=0,overdue=0,ewdAttention=0,ewdCritical=0;try{const r=await fetch('/api/asset-summary',{cache:'no-store'}),d=await r.json();if(r.ok){defects=Number(d.openDefects)||0;services=Number(d.serviceDue)||0}}catch{}try{const r=await fetch('/api/ewd/overview',{cache:'no-store'}),d=await r.json();if(r.ok){ewdAttention=Number(d.summary?.attention)||0;ewdCritical=Number(d.summary?.critical)||0}}catch{}try{const r=await fetch('/api/compliance/documents',{cache:'no-store'}),d=await r.json();if(r.ok&&Array.isArray(d)){cmp=d.reduce((n,x)=>n+Number(x.summary?.outstanding||0),0);overdue=d.reduce((n,x)=>n+Number(x.summary?.overdue||0),0)}}catch{}try{const r=await fetch('/api/employees',{cache:'no-store'}),d=await r.json();if(r.ok&&Array.isArray(d))people=d.filter(x=>Number(x.complianceHealth?.percent||0)<100).length}catch{}setBadge('ewdAttention',ewdAttention,ewdCritical?'alert':ewdAttention?'warn':'');setBadge('defects',defects,defects?'alert':'');setBadge('services',services,services?'warn':'');setBadge('compliance',cmp,overdue?'alert':cmp?'warn':'');setBadge('people',people,people?'warn':'');setGroupBadge('operations',defects+services+ewdAttention,(defects||ewdCritical)?'alert':(services||ewdAttention)?'warn':'');setGroupBadge('safety',cmp,overdue?'alert':cmp?'warn':'');setGroupBadge('people',people,people?'warn':'')}
  loadBadges();setInterval(loadBadges,60000);

  function runQuickQuery(){const params=new URLSearchParams(location.search),q=params.get('quick');if(!q)return;const map={addAsset:'addAssetBtn',addEmployee:'addEmployee',newCompliance:'newCmp',shareLocation:'shareLive'};const id=map[q];if(!id)return;let tries=0;const timer=setInterval(()=>{tries++;const el=document.getElementById(id);if(el){clearInterval(timer);el.click();params.delete('quick');const clean=location.pathname+(params.toString()?'?'+params.toString():'')+location.hash;history.replaceState({},'',clean)}else if(tries>30)clearInterval(timer)},100)}
  runQuickQuery();
})();
</script>`;

  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('id="svSidebar"')&&!body.includes('svSmartNavV1')){
      if(body.includes('</head>'))body=body.replace('</head>',style+'</head>');
      if(body.includes('</body>'))body=body.replace('</body>',script+'</body>');
    }
    return originalSend.call(this,body);
  };
}

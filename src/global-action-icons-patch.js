const express=require('express');

if(!express.response.__sv365GlobalActionIconsPatched){
  express.response.__sv365GlobalActionIconsPatched=true;
  const originalSend=express.response.send;

  const ui=String.raw`
<style id="sv365GlobalActionIconStyle">
.svActionIcon{width:36px!important;min-width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:0!important;border-radius:9px!important;line-height:1!important;vertical-align:middle;white-space:nowrap}
.svActionIcon svg{width:17px;height:17px;display:block;pointer-events:none}
.svActionIcon.svDangerIcon{color:#b42318!important;border-color:#efc4c0!important;background:#fffafa!important}
.svActionIcon.svDangerIcon:hover{background:#fff1f0!important;border-color:#e8a39d!important}
.svActionIcon.svSuccessIcon{color:#17884c!important;border-color:#bfe2ce!important;background:#f7fcf9!important}
.svActionIcon.svSuccessIcon:hover{background:#eef9f2!important;border-color:#9fd2b5!important}
.svActionIcon.svPrimaryIcon{color:#176eb5!important;border-color:#b9d8f1!important;background:#f7fbff!important}
.svActionIcon.svPrimaryIcon:hover{background:#edf7ff!important;border-color:#96c8ee!important}
.svActionIcon[disabled]{opacity:.55;cursor:not-allowed}
@media(max-width:700px){.svActionIcon{width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important}}
</style>
<script id="sv365GlobalActionIconScript">(()=>{
  if(window.__sv365GlobalActionIcons)return;window.__sv365GlobalActionIcons=true;
  const svg=(body)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>';
  const I={
    view:svg('<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>'),
    edit:svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>'),
    trash:svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>'),
    pdf:svg('<path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5"/><path d="M8.5 15h7M8.5 18h5"/>'),
    mail:svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
    download:svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>'),
    share:svg('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>'),
    unlink:svg('<path d="m10 13-1.5 1.5a4 4 0 0 1-5.7-5.7L6 5.6A4 4 0 0 1 11.7 5"/><path d="m14 11 1.5-1.5a4 4 0 0 1 5.7 5.7L18 18.4a4 4 0 0 1-5.7.6"/><path d="m8 8 8 8"/>'),
    link:svg('<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>'),
    check:svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>'),
    key:svg('<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2M14 9l2 2"/>'),
    health:svg('<path d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/><path d="M7 13h2l1.2-3 2.2 6 1.4-3H17"/>'),
    zoom:svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/><path d="M10.5 7.5v6M7.5 10.5h6"/>'),
    history:svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M4 4v5h5"/>'),
    map:svg('<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>'),
    external:svg('<path d="M14 3h7v7"/><path d="m10 14 11-11"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>'),
    refresh:svg('<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.7-2.6L20 11M4 13l2.2 4.6A7 7 0 0 0 17.9 15"/>'),
    copy:svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
    print:svg('<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>'),
    archive:svg('<path d="M3 5h18v4H3Z"/><path d="M5 9v11h14V9M10 13h4"/>'),
    play:svg('<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/>'),
    stop:svg('<circle cx="12" cy="12" r="9"/><rect x="9" y="9" width="6" height="6"/>'),
    pin:svg('<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'),
    warning:svg('<path d="M12 3 2.5 20h19Z"/><path d="M12 9v4M12 17h.01"/>'),
    loader:svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>')
  };
  const exact=new Map([
    ['view',['view','View']],['view details',['view','View details']],['details',['view','Details']],['open record',['view','Open record']],
    ['edit',['edit','Edit']],['edit asset',['edit','Edit asset']],['edit employee',['edit','Edit employee']],
    ['delete',['trash','Delete','danger']],['remove',['trash','Remove','danger']],['remove item',['trash','Remove item','danger']],
    ['pdf',['pdf','PDF']],['export pdf',['pdf','Export PDF']],['download pdf',['pdf','Download PDF']],
    ['email',['mail','Email']],['send email',['mail','Send email']],['email report',['mail','Email report']],
    ['download',['download','Download']],['export',['download','Export']],['export csv',['download','Export CSV']],
    ['share',['share','Share']],['share location',['share','Share location']],['copy',['copy','Copy']],['copy link',['copy','Copy link']],
    ['unlink',['unlink','Unlink','danger']],['disconnect',['unlink','Disconnect','danger']],['revoke',['unlink','Revoke','danger']],
    ['link',['link','Link']],['save link',['link','Save link']],['link asset',['link','Link asset']],['saved ✓',['check','Saved','success']],
    ['acknowledge',['check','Acknowledge','success']],['resolve',['check','Resolve','success']],['complete',['check','Complete','success']],['mark complete',['check','Mark complete','success']],
    ['health check',['health','Health Check']],['set pin',['key','Set PIN']],['reset pin',['key','Reset PIN']],['ewd pin',['key','EWD PIN']],
    ['zoom',['zoom','Zoom']],['history',['history','History']],['playback',['history','Playback']],['route',['map','Route']],['map',['map','Map']],['location',['pin','Location']],
    ['open',['external','Open']],['open asset',['external','Open asset']],['open gps',['external','Open GPS']],['live gps',['pin','Live GPS']],
    ['refresh',['refresh','Refresh']],['refresh units',['refresh','Refresh units']],['print',['print','Print']],['archive',['archive','Archive']],['restore',['refresh','Restore']],
    ['start',['play','Start']],['stop',['stop','Stop','danger']],['start ewd',['play','Start EWD']],['resume',['play','Resume']],
    ['flag',['warning','Flag']],['report',['warning','Report']],['assign',['link','Assign']],
    ['sending…',['loader','Sending']],['sending...',['loader','Sending']],['saving…',['loader','Saving']],['saving...',['loader','Saving']],['loading…',['loader','Loading']],['loading...',['loader','Loading']]
  ]);
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
  function inActionColumn(el){
    const td=el.closest('td');if(!td)return false;const tr=td.parentElement,table=td.closest('table');if(!tr||!table)return false;
    const cells=[...tr.children],index=cells.indexOf(td),heads=[...table.querySelectorAll('thead tr:first-child th')];
    const h=heads[index];return !!h&&/\bactions?\b/i.test(h.textContent||'');
  }
  function inActionGroup(el){
    const p=el.parentElement;if(!p)return false;
    if(el.closest('.modal .actions,.healthActions,.emailActions,.ewdPinActions,.formbody,.modalhead'))return false;
    const chain=[p,p.parentElement,p.parentElement?.parentElement].filter(Boolean);
    return chain.some(x=>/(histActions|employeeActions|unitActions|rowActions|itemActions|actionGroup|quickActions|gpsLinkedRow|shareRow|actionCell|actionsCell)/i.test(String(x.className||''))||['viewActions'].includes(x.id));
  }
  function qualifies(el){return inActionColumn(el)||inActionGroup(el)||el.hasAttribute('data-action-icon')}
  function actionFor(el){
    const current=norm(el.textContent);if(exact.has(current))return exact.get(current);
    const saved=norm(el.dataset.svActionLabel);if(saved&&exact.has(saved))return exact.get(saved);
    return null;
  }
  function apply(el){
    if(!(el instanceof HTMLElement)||!qualifies(el))return;
    const a=actionFor(el);if(!a)return;
    const [icon,label,tone]=a;
    if(!I[icon])return;
    if(!el.dataset.svActionLabel)el.dataset.svActionLabel=String(el.textContent||label).trim();
    el.classList.add('svActionIcon');
    el.classList.toggle('svDangerIcon',tone==='danger');el.classList.toggle('svSuccessIcon',tone==='success');el.classList.toggle('svPrimaryIcon',!tone&&['view','edit','pdf','mail','download','share','link','zoom','map','external','pin'].includes(icon));
    el.setAttribute('title',label);el.setAttribute('aria-label',label);
    if(el.innerHTML!==I[icon])el.innerHTML=I[icon];
  }
  function scan(root=document){
    if(root.nodeType===1&&root.matches?.('button,a'))apply(root);
    root.querySelectorAll?.('button,a').forEach(apply);
  }
  scan();
  let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan()})});
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();</script>`;

  express.response.send=function(body){
    const req=this.req;
    const isHtml=req&&typeof body==='string'&&body.includes('</body>')&&body.includes('<html');
    if(isHtml&&!body.includes('sv365GlobalActionIconScript'))body=body.replace('</body>',ui+'</body>');
    return originalSend.call(this,body);
  };
}

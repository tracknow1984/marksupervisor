const express=require('express');
if(!process.env.SV365_TENANT_ID||!process.send)throw new Error('Company operations must be started by the authenticated gateway');
const send=express.response.send;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
express.response.send=function(body){
  if(typeof body==='string'&&body.includes('</head>')&&body.includes('</body>')){
    const company=JSON.stringify(process.env.SV365_TENANT_ID).replace(/</g,'\\u003c');
    const contextScript=`<script>(function(){try{var company=${company};if(sessionStorage.getItem('sv365.company')!==company){for(var i=sessionStorage.length-1;i>=0;i--){var k=sessionStorage.key(i);if(k&&k.startsWith('sv365.'))sessionStorage.removeItem(k)}sessionStorage.setItem('sv365.company',company)}}catch(e){}})();</script>`;
    body=body.replace('</head>',contextScript+'</head>');
    let companyName='Company';try{companyName=decodeURIComponent(this.req.get('x-sv365-company-name')||'Company')}catch{}
    const banner='<div style="position:fixed;bottom:10px;right:12px;z-index:9999;background:#0b1928;color:#fff;border-radius:9px;padding:9px 13px;font:12px Arial,sans-serif;box-shadow:0 3px 12px #0003;max-width:calc(100vw - 24px)">'+esc(companyName)+' &nbsp; <a href="/onboarding" style="color:#75d5ef">Account</a> &nbsp; <a href="/api/auth/logout" style="color:#fff">Sign out</a></div>';
    body=body.replace('</body>',banner+'</body>');
  }
  return send.call(this,body);
};

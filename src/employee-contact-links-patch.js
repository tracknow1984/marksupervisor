const express=require('express');

if(!express.response.__sv365EmployeeContactLinksPatched){
  express.response.__sv365EmployeeContactLinksPatched=true;
  const originalSend=express.response.send;
  const injection=String.raw`
<style id="svEmployeeContactLinksStyle">
.employeeContactLink{color:#176eb5!important;text-decoration:none;font-weight:700;cursor:pointer}.employeeContactLink:hover{text-decoration:underline}.employeeSmsLink{display:inline-flex;align-items:center;gap:4px;margin-top:2px}
</style>
<script id="svEmployeeContactLinks">(()=>{
  if(location.pathname!=='/employees')return;
  const SMS_MESSAGE='Please check your compliance as there is outstanding or expired items that require your attention. Thankyou';
  const emailPattern=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
  function decorate(){
    document.querySelectorAll('#employeeRows tr').forEach(row=>{
      const cell=row.children&&row.children[1];
      if(!cell||cell.dataset.contactLinksReady==='1')return;
      const emailMatch=String(cell.textContent||'').match(emailPattern);
      const phoneNode=cell.querySelector('.sub');
      const phone=String(phoneNode?.textContent||'').trim();
      const email=String(emailMatch?.[0]||'').trim();
      if(!email&&!phone)return;
      cell.dataset.contactLinksReady='1';
      cell.textContent='';
      if(email){
        const emailLink=document.createElement('a');
        emailLink.className='employeeContactLink';
        emailLink.href='mailto:'+email;
        emailLink.textContent=email;
        emailLink.title='Email '+email;
        cell.appendChild(emailLink);
      }
      if(phone){
        const phoneWrap=document.createElement('div');
        phoneWrap.className='sub';
        const smsLink=document.createElement('a');
        smsLink.className='employeeContactLink employeeSmsLink';
        const smsPhone=phone.replace(/[^0-9+]/g,'');
        smsLink.href='sms:'+smsPhone+(isIOS?'&':'?')+'body='+encodeURIComponent(SMS_MESSAGE);
        smsLink.textContent=phone;
        smsLink.title='Send compliance reminder by SMS';
        phoneWrap.appendChild(smsLink);
        cell.appendChild(phoneWrap);
      }
    });
  }
  decorate();
  const target=document.getElementById('employeeRows');
  if(target)new MutationObserver(decorate).observe(target,{childList:true,subtree:true});
})();</script>`;

  express.response.send=function(body){
    if(this.req&&this.req.path==='/employees'&&typeof body==='string'&&body.includes('id="employeeRows"')&&!body.includes('svEmployeeContactLinks')&&body.includes('</body>')){
      body=body.replace('</body>',injection+'</body>');
    }
    return originalSend.call(this,body);
  };
}

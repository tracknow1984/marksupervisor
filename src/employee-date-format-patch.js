const express=require('express');

if(!express.response.__sv365EmployeeDateFormatPatched){
  express.response.__sv365EmployeeDateFormatPatched=true;
  const originalSend=express.response.send;
  const injection=String.raw`
<script id="svEmployeeDateFormatV1">
(()=>{
  if(location.pathname!=='/employees')return;
  const formatText=text=>String(text||'').replace(/\b(Valid to|Expired)\s+(\d{4})-(\d{2})-(\d{2})\b/g,(m,label,y,mo,d)=>label+' '+d+'/'+mo+'/'+y);
  function apply(){
    const rows=document.getElementById('employeeRows');
    if(!rows)return;
    rows.querySelectorAll('.validText,.expiredText').forEach(el=>{
      const next=formatText(el.textContent);
      if(next!==el.textContent)el.textContent=next;
    });
  }
  function start(){
    const rows=document.getElementById('employeeRows');
    if(!rows)return setTimeout(start,50);
    apply();
    new MutationObserver(apply).observe(rows,{childList:true,subtree:true,characterData:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
</script>`;

  express.response.send=function(body){
    const req=this.req;
    if(req&&req.path==='/employees'&&typeof body==='string'&&!body.includes('svEmployeeDateFormatV1')&&body.includes('</body>'))body=body.replace('</body>',injection+'</body>');
    return originalSend.call(this,body);
  };
}

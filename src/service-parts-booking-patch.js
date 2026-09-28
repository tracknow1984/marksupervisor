const express=require('express');
const script=require('fs').readFileSync(require('path').join(__dirname,'service-parts-booking-ui.js'),'utf8');
if(!express.response.__servicePartsBooking){
 express.response.__servicePartsBooking=true;const send=express.response.send;
 express.response.send=function(body){
  if(['/service','/assets','/service/parts'].includes(this.req?.path)&&typeof body==='string'&&body.includes('</body>'))body=body.replace('</body>',()=>'<style>.serviceForm [data-parts-panel][hidden],.serviceForm [data-parts-confirm-row][hidden]{display:none!important}</style><script id="servicePartsBooking">'+script+'</script><script>'+require('fs').readFileSync(require('path').join(__dirname,'service-types-ui.js'),'utf8')+'</script></body>');
  return send.call(this,body);
 };
}

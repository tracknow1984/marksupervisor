const express=require('express');
if(!express.response.__sv365SmartNavFixPatched){
  express.response.__sv365SmartNavFixPatched=true;
  const originalSend=express.response.send;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('svSmartNavV1')){
      body=body.replace("+(path==='/assets'||path==='/')?'active':''+'","+((path==='/assets'||path==='/')?'active':'')+");
    }
    return originalSend.call(this,body);
  };
}

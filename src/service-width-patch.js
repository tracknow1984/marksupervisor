const express=require('express');

// Match the Service Schedule content width to full-width pages such as Compliance.
if(!express.response.__sv365ServiceWidthPatched){
  express.response.__sv365ServiceWidthPatched=true;
  const originalSend=express.response.send;
  const style='<style id="svServiceWidthPatch">.serviceWrap{width:100%!important;max-width:none!important;margin:0!important}</style>';
  express.response.send=function(body){
    if(typeof body==='string'&&this.req&&this.req.path==='/service'&&body.includes('class="serviceWrap"')&&!body.includes('svServiceWidthPatch')&&body.includes('</head>')){
      body=body.replace('</head>',style+'</head>');
    }
    return originalSend.call(this,body);
  };
}

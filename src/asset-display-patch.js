const express=require('express');
const {assetLabels,displayHtml,displayText}=require('./asset-display');
const ui=require('fs').readFileSync(require('path').join(__dirname,'asset-display-ui.js'),'utf8');
// Installed first in the company worker so this runs after other HTML wrappers.
if(!express.response.__assetDisplay){
 express.response.__assetDisplay=true;
 const send=express.response.send;
 express.response.send=function(body){
  if(typeof body==='string'&&body.includes('</body>')){
   const labels=assetLabels();
   body=displayHtml(body,labels);
   if(!body.includes('id="svAssetDisplay"')){
    const json=JSON.stringify(labels).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
    body=body.replace('</body>',()=>'<script id="svAssetDisplay">'+ui.replace('__ASSET_LABELS__',()=>json)+'</script></body>');
   }
  }
  return send.call(this,body);
 };
}
// PDF exports share PDFKit. Resolve labels at render time in the current tenant.
const PDFDocument=require('pdfkit');
for(const method of ['text','widthOfString','heightOfString','boundsOfString']){
 const original=PDFDocument.prototype[method];
 if(typeof original!=='function')continue;
 PDFDocument.prototype[method]=function(value,...args){
  return original.call(this,typeof value==='string'?displayText(value):value,...args);
 };
}

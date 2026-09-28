(function(labels){
 if(window.svAssetDisplayReady)return;window.svAssetDisplayReady=true;
 const pattern=/\bAST-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
 const replace=value=>String(value).replace(pattern,id=>labels[id.toLowerCase()]||'Asset');
 function clean(node){
  if(node.nodeType===3){
   const parent=node.parentElement;
   if(!parent||parent.closest('script,style,textarea,[contenteditable]'))return;
   const next=replace(node.nodeValue);
   if(next!==node.nodeValue){
    // An option without a value uses its label as its submitted value.
    if(parent.tagName==='OPTION'&&!parent.hasAttribute('value'))parent.value=parent.textContent;
    node.nodeValue=next;
   }
  }else if(node.nodeType===1){
   if(node.matches('script,style,textarea,[contenteditable]'))return;
   for(const attr of ['title','alt','aria-label']){
    const value=node.getAttribute(attr);if(value!==null){const next=replace(value);if(next!==value)node.setAttribute(attr,next)}
   }
   for(const child of node.childNodes)clean(child);
  }
 }
 clean(document.documentElement);
 new MutationObserver(changes=>{
  for(const change of changes){
   if(change.type==='childList')change.addedNodes.forEach(clean);
   else clean(change.target);
  }
 }).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','alt','aria-label']});
})(__ASSET_LABELS__);

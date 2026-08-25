const express=require('express');

if(!express.response.__sv365AssetExpiryLegendPatched){
  express.response.__sv365AssetExpiryLegendPatched=true;
  const originalSend=express.response.send;

  const injection=String.raw`
<style id="svAssetExpiryLegendStyle">
.assetExpiryPageLegend{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:-7px 0 20px;padding:11px 14px;border:1px solid #e3e8ef;border-radius:10px;background:#fff;color:#748094;font-size:10px}.assetExpiryPageLegend strong{color:#465467;font-size:10px;text-transform:uppercase;letter-spacing:.55px}.assetExpiryLegendItems{display:flex;align-items:center;gap:15px;flex-wrap:wrap}.assetExpiryLegendItem{display:inline-flex;align-items:center;gap:6px}.assetExpiryLegendDot{width:9px;height:9px;border-radius:50%;display:inline-block}.assetExpiryLegendDot.red{background:#dc3f45}.assetExpiryLegendDot.yellow{background:#e5a324}.assetExpiryLegendDot.green{background:#22a06b}
th[data-expiry-head]{position:relative;cursor:help}th[data-expiry-head] .expiryHeadLabel{display:inline-flex;align-items:center;gap:5px}th[data-expiry-head] .expiryHelpMark{width:15px;height:15px;border-radius:50%;display:inline-grid;place-items:center;border:1px solid #cbd5df;background:#fff;color:#667085;font-size:9px;font-weight:900;text-transform:none}th[data-expiry-head] .expiryHeaderTip{position:absolute;left:50%;bottom:calc(100% + 9px);transform:translate(-50%,4px);width:265px;padding:10px 11px;border-radius:9px;background:#101827;color:#e7edf5;font-size:10px;font-weight:600;line-height:1.5;text-transform:none;letter-spacing:0;white-space:normal;box-shadow:0 14px 35px rgba(0,0,0,.25);opacity:0;visibility:hidden;pointer-events:none;transition:.14s ease;z-index:80}th[data-expiry-head] .expiryHeaderTip:after{content:'';position:absolute;left:50%;top:100%;width:8px;height:8px;background:#101827;transform:translate(-50%,-4px) rotate(45deg)}th[data-expiry-head]:hover .expiryHeaderTip,th[data-expiry-head]:focus-within .expiryHeaderTip{opacity:1;visibility:visible;transform:translate(-50%,0)}.expiryTipRow{display:flex;align-items:flex-start;gap:7px;margin:3px 0}.expiryTipDot{width:8px;height:8px;border-radius:50%;margin-top:3px;flex:0 0 8px}.expiryTipDot.red{background:#f05a61}.expiryTipDot.yellow{background:#f2b53e}.expiryTipDot.green{background:#36b77e}@media(max-width:700px){.assetExpiryPageLegend{align-items:flex-start}.assetExpiryLegendItems{display:grid;gap:7px}th[data-expiry-head] .expiryHeaderTip{display:none}}
</style>
<script id="svAssetExpiryLegendV1">
(()=>{
  const rows=document.getElementById('rows');
  if(!rows||document.getElementById('assetExpiryPageLegend'))return;
  function enhance(){
    const table=rows.closest('table'),head=table&&table.querySelector('th[data-expiry-head]');
    if(!head)return false;
    if(!head.querySelector('.expiryHeadLabel'))head.innerHTML='<span class="expiryHeadLabel">Expiry <span class="expiryHelpMark" aria-hidden="true">?</span></span><div class="expiryHeaderTip"><div class="expiryTipRow"><span class="expiryTipDot red"></span><span><b>Red</b> — expired or required expiry date is missing</span></div><div class="expiryTipRow"><span class="expiryTipDot yellow"></span><span><b>Yellow</b> — expires within 30 days</span></div><div class="expiryTipRow"><span class="expiryTipDot green"></span><span><b>Green</b> — all required dates are recorded and more than 30 days away</span></div></div>';
    const panel=table.closest('.panel');
    if(panel&&!document.getElementById('assetExpiryPageLegend')){
      const guide=document.createElement('div');guide.id='assetExpiryPageLegend';guide.className='assetExpiryPageLegend';guide.innerHTML='<strong>Expiry Status Guide</strong><div class="assetExpiryLegendItems"><span class="assetExpiryLegendItem"><i class="assetExpiryLegendDot red"></i> Red — expired or date missing</span><span class="assetExpiryLegendItem"><i class="assetExpiryLegendDot yellow"></i> Yellow — due within 30 days</span><span class="assetExpiryLegendItem"><i class="assetExpiryLegendDot green"></i> Green — all dates current</span></div>';
      panel.insertAdjacentElement('afterend',guide);
    }
    return true;
  }
  if(!enhance()){
    const observer=new MutationObserver(()=>{if(enhance())observer.disconnect()});
    observer.observe(rows.closest('table')||document.body,{childList:true,subtree:true});
  }
})();
</script>`;

  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('id="rows"')&&body.includes('id="addAssetBtn"')&&!body.includes('svAssetExpiryLegendV1')){
      if(body.includes('</body>'))body=body.replace('</body>',injection+'</body>');
    }
    return originalSend.call(this,body);
  };
}

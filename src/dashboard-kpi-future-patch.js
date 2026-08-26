const express=require('express');

// Restyle only the Dashboard KPI strip into a compact futuristic command deck.
if(!express.response.__sv365DashboardKpiFuturePatched){
  express.response.__sv365DashboardKpiFuturePatched=true;
  const originalSend=express.response.send;
  const style=String.raw`<style id="svDashboardKpiFutureStyle">
/* Supervisor365 compact command-deck KPI treatment — dashboard only */
.kpiGrid{
  position:relative!important;
  isolation:isolate;
  display:grid!important;
  grid-template-columns:repeat(8,minmax(0,1fr))!important;
  gap:7px!important;
  margin:0 0 14px!important;
  padding:8px!important;
  border:1px solid rgba(86,151,195,.22)!important;
  border-radius:16px!important;
  background:
    linear-gradient(180deg,rgba(12,25,39,.98),rgba(7,17,28,.98))!important;
  box-shadow:0 14px 36px rgba(7,17,28,.14),inset 0 1px rgba(255,255,255,.035)!important;
  overflow:hidden!important;
}
.kpiGrid:before{
  content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
  background:
    linear-gradient(90deg,transparent 0,rgba(54,199,242,.055) 1px,transparent 1px),
    linear-gradient(0deg,transparent 0,rgba(54,199,242,.035) 1px,transparent 1px),
    radial-gradient(circle at 50% -80%,rgba(48,195,238,.18),transparent 46%);
  background-size:44px 44px,44px 44px,100% 100%;
  opacity:.9;
}
.kpiGrid:after{
  content:"";position:absolute;left:8%;right:8%;top:0;height:1px;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(67,211,248,.78),transparent);
  box-shadow:0 0 12px rgba(50,204,242,.45);
}
.kpi{
  position:relative!important;
  min-height:88px!important;
  padding:10px 10px 9px!important;
  border-radius:11px!important;
  border:1px solid rgba(124,161,191,.15)!important;
  background:linear-gradient(145deg,rgba(22,41,59,.88),rgba(11,25,39,.9))!important;
  box-shadow:inset 0 1px rgba(255,255,255,.035),0 5px 14px rgba(0,0,0,.11)!important;
  overflow:hidden!important;
  transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease!important;
}
.kpi:before{
  content:"";position:absolute;left:0;top:13px;bottom:13px;width:2px;border-radius:0 2px 2px 0;
  background:linear-gradient(#48d7fa,#247bc9);opacity:.82;
  box-shadow:0 0 9px rgba(55,203,242,.3);
}
.kpi:after{
  content:"";position:absolute;width:56px;height:56px;right:-24px;top:-26px;border-radius:50%;
  background:radial-gradient(circle,rgba(68,205,243,.14),transparent 68%);pointer-events:none;
}
.kpi:hover{
  transform:translateY(-2px)!important;
  border-color:rgba(76,207,243,.35)!important;
  background:linear-gradient(145deg,rgba(25,48,68,.96),rgba(12,29,44,.96))!important;
  box-shadow:inset 0 1px rgba(255,255,255,.05),0 9px 22px rgba(3,12,22,.2),0 0 18px rgba(49,193,232,.06)!important;
}
.kpi.red:before{background:linear-gradient(#ff7777,#bd3535);box-shadow:0 0 9px rgba(234,75,75,.28)}
.kpi.amber:before{background:linear-gradient(#ffd36c,#c78512);box-shadow:0 0 9px rgba(221,155,37,.28)}
.kpi.green:before{background:linear-gradient(#65e39d,#238b58);box-shadow:0 0 9px rgba(54,192,116,.25)}
.kpiTop{gap:5px!important;align-items:center!important}
.kpiLabel{
  color:#8fa3b8!important;font-size:7.5px!important;line-height:1.18!important;
  letter-spacing:.8px!important;font-weight:900!important;white-space:nowrap!important;
}
.kpiIcon{
  width:27px!important;height:27px!important;flex:0 0 27px!important;border-radius:8px!important;
  color:#4ed1f4!important;background:rgba(42,177,220,.11)!important;
  border:1px solid rgba(75,207,243,.14)!important;
  box-shadow:inset 0 0 12px rgba(45,194,234,.035)!important;
}
.kpiIcon svg{width:14px!important;height:14px!important;stroke-width:1.75!important}
.kpi.red .kpiIcon{color:#ff8585!important;background:rgba(207,62,62,.11)!important;border-color:rgba(232,92,92,.15)!important}
.kpi.amber .kpiIcon{color:#ffc95f!important;background:rgba(202,139,26,.11)!important;border-color:rgba(231,170,55,.15)!important}
.kpi.green .kpiIcon{color:#63dea0!important;background:rgba(37,160,94,.11)!important;border-color:rgba(72,198,126,.15)!important}
.kpiValue{
  color:#f5faff!important;font-size:22px!important;line-height:.95!important;font-weight:900!important;
  margin-top:7px!important;letter-spacing:-.7px!important;text-shadow:0 0 18px rgba(104,210,239,.07)!important;
}
.kpiSub{
  color:#71869b!important;font-size:7.5px!important;line-height:1.3!important;margin-top:6px!important;
  gap:4px!important;white-space:normal!important;
}
.kpiSub b{color:#afc2d3!important;font-weight:850!important}
.kpiLink{z-index:5!important}
@media(max-width:1380px){.kpiGrid{grid-template-columns:repeat(4,minmax(0,1fr))!important}.kpi{min-height:86px!important}}
@media(max-width:760px){.kpiGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;padding:7px!important}.kpi{min-height:88px!important}.kpiLabel{font-size:7.5px!important}.kpiValue{font-size:22px!important}}
@media(max-width:430px){.kpiGrid{grid-template-columns:1fr 1fr!important;gap:6px!important}.kpi{padding:9px!important}.kpiIcon{width:25px!important;height:25px!important;flex-basis:25px!important}.kpiSub{font-size:7px!important}}
</style>`;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('class="kpiGrid"')&&!body.includes('svDashboardKpiFutureStyle')&&body.includes('</body>')){
      body=body.replace('</body>',style+'</body>');
    }
    return originalSend.call(this,body);
  };
}

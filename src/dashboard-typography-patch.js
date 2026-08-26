const express=require('express');

// Slightly increase Dashboard typography without changing its layout or visual language.
if(!express.response.__sv365DashboardTypographyPatched){
  express.response.__sv365DashboardTypographyPatched=true;
  const originalSend=express.response.send;
  const style=String.raw`<style id="svDashboardTypographyStyle">
/* Dashboard readability pass — deliberately modest so the compact layout is preserved. */
.dashEyebrow{font-size:11px!important}
.dashHero h1{font-size:32px!important}
.dashHero p{font-size:13px!important;line-height:1.45!important}
.statusChip{font-size:11px!important}
.quickAction b{font-size:12px!important}
.quickAction span{font-size:10px!important;line-height:1.35!important}

/* Compact futuristic KPI command deck */
.kpiLabel{font-size:8.6px!important;line-height:1.22!important;letter-spacing:.72px!important}
.kpiValue{font-size:24px!important}
.kpiSub{font-size:8.5px!important;line-height:1.38!important}

/* Main dashboard panels */
.panelHead h2{font-size:15.5px!important}
.panelHead p{font-size:10px!important;line-height:1.4!important}
.panelLink{font-size:10px!important}
.rowTitle{font-size:12px!important;line-height:1.35!important}
.rowSub{font-size:10px!important;line-height:1.4!important}
.rowMetric{font-size:10px!important}
.rowMetric b{font-size:12px!important}
.legendRow{font-size:11px!important}
.legendRow b{font-size:13px!important}
.trendLabel{font-size:10px!important}
.trendCount{font-size:9px!important}
.priorityRow label{font-size:10px!important}
.priorityRow b{font-size:12px!important}
.mapStat span{font-size:9px!important}
.mapStat b{font-size:16px!important}
.driverState{font-size:9px!important}
.activityTime{font-size:9px!important}
.emptyDash{font-size:11px!important}

/* Supervisor365 Intelligence */
.intelBrand b{font-size:13px!important}
.intelBrand span{font-size:9px!important}
.intelLive{font-size:9px!important}
.scoreValue b{font-size:25px!important}
.scoreValue span{font-size:8px!important}
.scoreCopy b{font-size:12px!important}
.scoreCopy span{font-size:9px!important;line-height:1.45!important}
.intelEyebrow{font-size:8px!important}
.intelBriefText{font-size:12px!important;line-height:1.55!important}
.intelSignal{font-size:8.5px!important}
.intelActionTitle{font-size:10px!important}
.intelActionDetail{font-size:9px!important;line-height:1.45!important}
.intelActionGo{font-size:9px!important}
.intelAskLabel{font-size:9px!important}
.intelInputWrap input{font-size:10px!important}
.intelAsk button{font-size:9px!important}
.intelAnswer{font-size:10px!important;line-height:1.6!important}
.intelPrompt{font-size:8px!important}

@media(max-width:760px){
  .dashHero h1{font-size:28px!important}
  .kpiLabel{font-size:8.5px!important}
  .kpiValue{font-size:23px!important}
  .kpiSub{font-size:8.3px!important}
}
</style>`;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('class="dash"')&&body.includes('</body>')&&!body.includes('svDashboardTypographyStyle')){
      body=body.replace('</body>',style+'</body>');
    }
    return originalSend.call(this,body);
  };
}

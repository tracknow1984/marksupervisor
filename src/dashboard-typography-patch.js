const express=require('express');

// Slightly increase Dashboard typography without changing its layout or visual language.
if(!express.response.__sv365DashboardTypographyPatched){
  express.response.__sv365DashboardTypographyPatched=true;
  const originalSend=express.response.send;
  const style=String.raw`<style id="svDashboardTypographyStyle">
/* Dashboard readability pass — deliberately modest so the compact layout is preserved. */
.dash .dashEyebrow{font-size:12.5px!important}
.dash .dashHero h1{font-size:34px!important}
.dash .dashHero p{font-size:14.5px!important;line-height:1.45!important}
.dash .statusChip{font-size:12.5px!important}
.dash .quickAction b{font-size:13.5px!important}
.dash .quickAction span{font-size:11.5px!important;line-height:1.35!important}

/* Scope rules to .dash so later KPI styling cannot override readability. */
.dash .kpiLabel{font-size:10.1px!important;line-height:1.22!important;letter-spacing:.5px!important;white-space:normal!important;overflow-wrap:anywhere;min-width:0}
.dash .kpiValue{font-size:26px!important}
.dash .kpiSub{font-size:10px!important;line-height:1.38!important}

/* Allow compact cards and score text to wrap as typography grows. */
.dash .quickAction>div:last-child,.dash .scoreCopy{min-width:0;overflow-wrap:anywhere}
.dash .donutCenter b{font-size:27px!important}
.dash .donutCenter span{font-size:10.5px!important}

/* Main dashboard panels */
.dash .panelHead h2{font-size:17px!important}
.dash .panelHead p{font-size:11.5px!important;line-height:1.4!important}
.dash .panelLink{font-size:11.5px!important}
.dash .rowTitle{font-size:13.5px!important;line-height:1.35!important}
.dash .rowSub{font-size:11.5px!important;line-height:1.4!important}
.dash .rowMetric{font-size:11.5px!important}
.dash .rowMetric b{font-size:13.5px!important}
.dash .legendRow{font-size:12.5px!important}
.dash .legendRow b{font-size:14.5px!important}
.dash .trendLabel{font-size:11.5px!important}
.dash .trendCount{font-size:10.5px!important}
.dash .priorityRow label{font-size:11.5px!important}
.dash .priorityRow b{font-size:13.5px!important}
.dash .mapStat span{font-size:10.5px!important}
.dash .mapStat b{font-size:17.5px!important}
.dash .driverState{font-size:10.5px!important}
.dash .activityTime{font-size:10.5px!important}
.dash .emptyDash{font-size:12.5px!important}

/* Supervisor365 Intelligence */
.dash .intelBrand b{font-size:14.5px!important}
.dash .intelBrand span{font-size:10.5px!important}
.dash .intelLive{font-size:10.5px!important}
.dash .scoreValue b{font-size:27px!important}
.dash .scoreValue span{font-size:9.5px!important}
.dash .scoreCopy b{font-size:13.5px!important}
.dash .scoreCopy span{font-size:10.5px!important;line-height:1.45!important}
.dash .intelEyebrow{font-size:9.5px!important}
.dash .intelBriefText{font-size:13.5px!important;line-height:1.55!important}
.dash .intelSignal{font-size:10px!important}
.dash .intelActionTitle{font-size:11.5px!important}
.dash .intelActionDetail{font-size:10.5px!important;line-height:1.45!important}
.dash .intelActionGo{font-size:10.5px!important}
.dash .intelAskLabel{font-size:10.5px!important}
.dash .intelInputWrap input{font-size:11.5px!important}
.dash .intelAsk button{font-size:10.5px!important}
.dash .intelAnswer{font-size:11.5px!important;line-height:1.6!important}
.dash .intelPrompt{font-size:9.5px!important}

@media(max-width:760px){
  .dash .dashHero h1{font-size:30px!important}
  .dash .kpiLabel{font-size:10px!important}
  .dash .kpiValue{font-size:25px!important}
  .dash .kpiSub{font-size:9.8px!important}
}
</style>`;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('class="dash"')&&body.includes('</body>')&&!body.includes('svDashboardTypographyStyle')){
      body=body.replace('</body>',style+'</body>');
    }
    return originalSend.call(this,body);
  };
}

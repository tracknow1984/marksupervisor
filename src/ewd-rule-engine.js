const MIN=60000;

// Built-in advisory rule profiles. The EWD Standards require NHVR-issued machine-readable
// rule sets to be the approval source of truth. These profiles support the candidate build
// and must be replaced/validated against the NHVR Application Toolkit before approval use.
const RULE_SETS={
  Standard:{
    id:'STANDARD_SOLO_REFERENCE_2026',label:'Standard Hours - Solo',validated:false,
    rules:[
      {id:'STD-5H30',periodMin:330,maxWorkMin:315,minRestMin:15,restBlockMin:15,label:'5½ hour rule'},
      {id:'STD-8H',periodMin:480,maxWorkMin:450,minRestMin:30,restBlockMin:15,label:'8 hour rule'},
      {id:'STD-11H',periodMin:660,maxWorkMin:600,minRestMin:60,restBlockMin:15,label:'11 hour rule'},
      {id:'STD-24H',periodMin:1440,maxWorkMin:720,minContinuousRestMin:420,label:'24 hour rule'},
      {id:'STD-7D',periodMin:10080,maxWorkMin:4320,minContinuousRestMin:1440,label:'7 day rule'},
      {id:'STD-14D',periodMin:20160,maxWorkMin:8640,label:'14 day rule',special:'night-rest'}
    ]
  },
  BFM:{
    id:'BFM_SOLO_TRANSITION_REFERENCE_2026',label:'BFM - Solo (transitional)',validated:false,
    rules:[
      {id:'BFM-6H15',periodMin:375,maxWorkMin:360,minRestMin:15,restBlockMin:15,label:'6¼ hour rule'},
      {id:'BFM-9H',periodMin:540,maxWorkMin:510,minRestMin:30,restBlockMin:15,label:'9 hour rule'},
      {id:'BFM-12H',periodMin:720,maxWorkMin:660,minRestMin:60,restBlockMin:15,label:'12 hour rule'},
      {id:'BFM-24H',periodMin:1440,maxWorkMin:840,minContinuousRestMin:420,label:'24 hour rule'},
      {id:'BFM-7D-LN',periodMin:10080,maxLongNightMin:2160,label:'7 day long/night work rule',special:'long-night'},
      {id:'BFM-14D',periodMin:20160,maxWorkMin:8640,label:'14 day rule',special:'major-rest-night'}
    ]
  }
};

function ms(v){const n=new Date(v||0).getTime();return Number.isFinite(n)?n:0}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function round1(n){return Math.round(n*10)/10}
function eventSegments(events,until=new Date().toISOString()){
  const rows=[...(events||[])].filter(e=>e&&['Work','Rest'].includes(e.eventType)&&ms(e.startTime)).sort((a,b)=>ms(a.startTime)-ms(b.startTime));
  return rows.map((e,i)=>({event:e,type:e.eventType,start:ms(e.startTime),end:i+1<rows.length?ms(rows[i+1].startTime):ms(until)})).filter(x=>x.end>x.start);
}
function overlapMinutes(seg,from,to){return Math.max(0,Math.min(seg.end,to)-Math.max(seg.start,from))/MIN}
function totalsInWindow(segments,from,to){
  let work=0,rest=0,maxContinuousRest=0,qualifyingRest15=0;
  for(const s of segments){
    const m=overlapMinutes(s,from,to);if(!m)continue;
    if(s.type==='Work')work+=m;
    else{rest+=m;maxContinuousRest=Math.max(maxContinuousRest,m);if(m>=15)qualifyingRest15+=m}
  }
  return{work,rest,maxContinuousRest,qualifyingRest15};
}
function dayTotals(segments,nowMs){
  const d=new Date(nowMs),from=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  return totalsInWindow(segments,from,nowMs);
}
function durationLabel(mins){
  if(mins==null||!Number.isFinite(mins))return'—';
  const sign=mins<0?'-':'',m=Math.max(0,Math.round(Math.abs(mins))),h=Math.floor(m/60),r=m%60;
  return sign+(h?h+'h ':'')+r+'m';
}
function severityFromRemaining(min){if(min<=0)return'critical';if(min<=5)return'severe';if(min<=15)return'warning';if(min<=30)return'notice';if(min<=60)return'advisory';return'ok'}
function currentActivity(events){const last=[...(events||[])].filter(x=>['Work','Rest'].includes(x.eventType)).sort((a,b)=>ms(b.startTime)-ms(a.startTime))[0];return last?.eventType||'Rest'}
function analyse(events,option='Standard',nowIso=new Date().toISOString()){
  const profile=RULE_SETS[option]||RULE_SETS.Standard,now=ms(nowIso),segments=eventSegments(events,nowIso),activity=currentActivity(events),checks=[];
  for(const rule of profile.rules){
    const from=now-rule.periodMin*MIN,t=totalsInWindow(segments,from,now),remaining=rule.maxWorkMin==null?null:rule.maxWorkMin-t.work;
    let restOk=true,restMessage='';
    if(rule.minContinuousRestMin!=null){restOk=t.maxContinuousRest>=rule.minContinuousRestMin;restMessage=`Longest rest ${durationLabel(t.maxContinuousRest)} / ${durationLabel(rule.minContinuousRestMin)} required`}
    else if(rule.minRestMin!=null){restOk=t.qualifyingRest15>=rule.minRestMin;restMessage=`Qualifying rest ${durationLabel(t.qualifyingRest15)} / ${durationLabel(rule.minRestMin)} required`}
    checks.push({id:rule.id,label:rule.label,periodMin:rule.periodMin,maxWorkMin:rule.maxWorkMin??null,workMin:round1(t.work),remainingWorkMin:remaining==null?null:round1(remaining),restOk,restMessage,special:rule.special||null,severity:remaining==null?'info':severityFromRemaining(remaining)});
  }
  const actionable=checks.filter(x=>x.remainingWorkMin!=null).sort((a,b)=>a.remainingWorkMin-b.remainingWorkMin);
  const next=actionable[0]||null,day=dayTotals(segments,now),potential=checks.filter(x=>x.remainingWorkMin!=null&&x.remainingWorkMin<0).map(x=>({time:nowIso,workRestOption:option,period:x.label,activity:'Work',level:x.remainingWorkMin<=-30?'Critical':x.remainingWorkMin<=-15?'Severe':x.remainingWorkMin<=-5?'Substantial':'Minor',description:`Work exceeds ${x.label} reference threshold by ${durationLabel(-x.remainingWorkMin)}`}));
  const currentSeg=segments[segments.length-1],currentDuration=currentSeg?Math.max(0,(now-currentSeg.start)/MIN):0;
  let message='Work and rest monitoring active.';
  if(activity==='Rest')message=`Rest in progress for ${durationLabel(currentDuration)}. Resume work only when your required rest is complete.`;
  else if(next){
    if(next.remainingWorkMin<=0)message=`Potential non-compliance: ${next.label} work threshold reached. Stop work and take the required rest.`;
    else if(next.remainingWorkMin<=15)message=`Break required soon: ${durationLabel(next.remainingWorkMin)} remaining before ${next.label}.`;
    else if(next.remainingWorkMin<=60)message=`Next fatigue limit in ${durationLabel(next.remainingWorkMin)} (${next.label}). Plan a safe stopping location.`;
    else message=`Next fatigue limit in ${durationLabel(next.remainingWorkMin)} (${next.label}).`;
  }
  return{
    option,profileId:profile.id,profileLabel:profile.label,ruleSetValidated:!!profile.validated,activity,currentActivityMinutes:round1(currentDuration),totalWorkTodayMin:round1(day.work),totalRestTodayMin:round1(day.rest),nextLimit:next?{ruleId:next.id,label:next.label,remainingWorkMin:next.remainingWorkMin,severity:next.severity}:null,message,checks,potentialNonCompliance:potential
  };
}
function tripTotals(events,startedAt,endedAt){
  const segments=eventSegments(events,endedAt||new Date().toISOString()),from=ms(startedAt),to=ms(endedAt||new Date().toISOString()),t=totalsInWindow(segments,from,to);
  return{workMin:round1(t.work),restMin:round1(t.rest),elapsedMin:round1(Math.max(0,(to-from)/MIN)),workLabel:durationLabel(t.work),restLabel:durationLabel(t.rest),elapsedLabel:durationLabel((to-from)/MIN)};
}
function gpsDistanceKm(points){
  const rows=(points||[]).filter(p=>Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude)));
  const R=6371,toRad=x=>x*Math.PI/180;let km=0;
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1],b=rows[i],lat1=toRad(Number(a.latitude)),lat2=toRad(Number(b.latitude)),dLat=lat2-lat1,dLon=toRad(Number(b.longitude)-Number(a.longitude));
    const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;km+=2*R*Math.asin(Math.sqrt(clamp(h,0,1)));
  }
  return round1(km);
}
module.exports={RULE_SETS,analyse,tripTotals,gpsDistanceKm,durationLabel,eventSegments};

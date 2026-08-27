const express=require('express');

// This wrapper is intentionally installed BEFORE smart-nav-patch.
// Because response wrappers unwind in reverse order, it receives the final smart-nav
// HTML after that patch has generated its script, and makes EWD a first-class nav item.
if(!express.response.__sv365EwdCoreNavFix){
  express.response.__sv365EwdCoreNavFix=true;
  const originalSend=express.response.send;
  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('svSmartNavV1')){
      const prestart=`{label:'Pre-Starts',href:'/prestarts',desc:'Start and manage inspections'},`;
      const ewd=`{label:'Electronic Work Diary',href:'/ewd',desc:'Driver work, rest and fatigue management'},`;
      if(!body.includes(`{label:'Electronic Work Diary',href:'/ewd'`)){
        body=body.replace(prestart,prestart+'\n      '+ewd);
      }

      const destinationPrestart=`{label:'Pre-Starts',href:'/prestarts',desc:'Daily inspections'},`;
      const destinationEwd=`{label:'Electronic Work Diary',href:'/ewd',desc:'Work, rest and fatigue management'},`;
      if(!body.includes(destinationEwd)){
        body=body.replace(destinationPrestart,destinationPrestart+'\n    '+destinationEwd);
      }

      const actionPrestart=`{label:'Start Pre-Start',href:'/prestarts',desc:'Begin a vehicle or asset inspection',icon:'✓'},`;
      const actionEwd=`{label:'Open Electronic Work Diary',href:'/ewd',desc:'Resume or start driver work and rest recording',icon:'◴'},`;
      if(!body.includes(actionEwd)){
        body=body.replace(actionPrestart,actionPrestart+'\n    '+actionEwd);
      }
    }
    return originalSend.call(this,body);
  };
}

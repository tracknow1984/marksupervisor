const express=require('express');

// Permanently splice Geofence Alerts into the generated smart-navigation source before the
// browser executes it. This avoids relying on a later DOM mutation, which can miss the menu
// depending on response-wrapper order or page timing.
if(!express.response.__sv365GeofenceNavCoreFixed){
  express.response.__sv365GeofenceNavCoreFixed=true;
  const originalSend=express.response.send;

  express.response.send=function(body){
    if(typeof body==='string'&&body.includes('svSmartNavV1')){
      if(!body.includes("href:'/gps-geofence-alerts'")){
        const fleetNeedle="      {label:'Live GPS',href:'/gps',desc:'Tracked assets and geofences'},\n      {label:'Service History',href:'/service-history',desc:'Completed servicing records'}";
        const fleetReplacement="      {label:'Live GPS',href:'/gps',desc:'Tracked assets and geofences'},\n      {label:'Geofence Alerts',href:'/gps-geofence-alerts',desc:'Monitor departures without compliant Pre-Starts',icon:'<svg viewBox=\"0 0 24 24\"><path d=\"M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z\"/><circle cx=\"12\" cy=\"10\" r=\"2\"/><path d=\"M17 5l3-2M18.5 8H22\"/></svg>',badge:'gfAlerts'},\n      {label:'Service History',href:'/service-history',desc:'Completed servicing records'}";
        if(body.includes(fleetNeedle))body=body.replace(fleetNeedle,fleetReplacement);

        const destinationNeedle="    {label:'Live GPS',href:'/gps',desc:'Wialon tracking'},";
        const destinationReplacement="    {label:'Live GPS',href:'/gps',desc:'Wialon tracking'},\n    {label:'Geofence Alerts',href:'/gps-geofence-alerts',desc:'GPS departure and Pre-Start compliance alerts'},";
        if(body.includes(destinationNeedle))body=body.replace(destinationNeedle,destinationReplacement);

        const actionNeedle="    {label:'Live GPS',href:'/gps',desc:'Open fleet tracking',icon:'⌖'},";
        const actionReplacement="    {label:'Live GPS',href:'/gps',desc:'Open fleet tracking',icon:'⌖'},\n    {label:'Geofence Alerts',href:'/gps-geofence-alerts',desc:'Review GPS departure compliance alerts',icon:'⚠'},";
        if(body.includes(actionNeedle))body=body.replace(actionNeedle,actionReplacement);
      }

      // The alert UI was originally built for a DOM-inserted badge. Keep it compatible with the
      // permanent smart-nav badge as well so both old and new rendered pages receive live counts.
      body=body.replace("document.querySelectorAll('[data-gf-alert-badge]').forEach", "document.querySelectorAll('[data-gf-alert-badge],[data-badge=\\\"gfAlerts\\\"]').forEach");
    }
    return originalSend.call(this,body);
  };
}

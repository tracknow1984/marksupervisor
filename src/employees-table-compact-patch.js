const express=require('express');

if(!express.response.__sv365EmployeesTableCompactPatched){
  express.response.__sv365EmployeesTableCompactPatched=true;
  const originalSend=express.response.send;
  const style=String.raw`
<style id="svEmployeesTableCompactStyle">
body .panel:has(#employeeRows){max-width:1180px;margin-left:auto;margin-right:auto}
body .panel:has(#employeeRows) .tablewrap{overflow-x:auto;padding:0 4px}
body .panel:has(#employeeRows) table{width:100%;min-width:0!important;table-layout:fixed}
body .panel:has(#employeeRows) th,body .panel:has(#employeeRows) td{padding:8px 7px!important;font-size:10.5px;vertical-align:middle;overflow-wrap:anywhere}
body .panel:has(#employeeRows) th{font-size:8px;letter-spacing:.45px;white-space:normal}
body .panel:has(#employeeRows) th:nth-child(1),body .panel:has(#employeeRows) td:nth-child(1){width:15%}
body .panel:has(#employeeRows) th:nth-child(2),body .panel:has(#employeeRows) td:nth-child(2){width:19%}
body .panel:has(#employeeRows) th:nth-child(3),body .panel:has(#employeeRows) td:nth-child(3){width:10%}
body .panel:has(#employeeRows) th:nth-child(4),body .panel:has(#employeeRows) td:nth-child(4){width:15%}
body .panel:has(#employeeRows) th:nth-child(5),body .panel:has(#employeeRows) td:nth-child(5){width:23%}
body .panel:has(#employeeRows) th:nth-child(6),body .panel:has(#employeeRows) td:nth-child(6){width:10%}
body .panel:has(#employeeRows) th:nth-child(7),body .panel:has(#employeeRows) td:nth-child(7){width:8%}
body .panel:has(#employeeRows) .healthCell{min-width:0!important}
body .panel:has(#employeeRows) .healthTop{gap:5px;margin-bottom:5px}
body .panel:has(#employeeRows) .healthTrack{height:6px}
body .panel:has(#employeeRows) .checkPills{gap:3px;margin-top:5px}
body .panel:has(#employeeRows) .checkPill{font-size:8px;padding:3px 5px}
body .panel:has(#employeeRows) .healthBtn,body .panel:has(#employeeRows) .ewdPinBtn{padding:5px 6px!important;font-size:8.5px!important;white-space:nowrap}
body .panel:has(#employeeRows) .ewdPinStatus{padding:4px 6px;font-size:8px}
@media(max-width:1100px){body .panel:has(#employeeRows){max-width:100%}body .panel:has(#employeeRows) table{min-width:930px!important}}
</style>`;
  express.response.send=function(body){
    const req=this.req;
    if(req&&req.path==='/employees'&&typeof body==='string'&&!body.includes('svEmployeesTableCompactStyle')&&body.includes('</head>'))body=body.replace('</head>',style+'</head>');
    return originalSend.call(this,body);
  };
}

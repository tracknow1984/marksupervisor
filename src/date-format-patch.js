const express = require('express');
const fs = require('fs');
const path = require('path');
// Follow the app's existing response-wrapper architecture, including public pages.
if (!express.response.__sv365DateFormat) {
  express.response.__sv365DateFormat = true;
  const originalSend = express.response.send;
  const script = fs.readFileSync(path.join(__dirname,'date-format-ui.js'),'utf8');
  const style = '<style id="svDateFormatStyle">.svDateControl{display:inline-flex;position:relative;align-items:center;width:100%;min-width:0}.svDateControl>.svDateDisplay{width:100%;padding-right:40px!important}.svDateControl>.svDateNative{position:absolute!important;right:3px!important;width:30px!important;min-width:0!important;height:30px!important;padding:0!important;border:0!important;color:transparent!important;background:transparent!important;overflow:hidden}.svDateNative::-webkit-datetime-edit{display:none}.svDateNative::-webkit-calendar-picker-indicator{width:22px;height:22px;margin:0;cursor:pointer}</style>';
  express.response.send = function(body) {
    if (typeof body === 'string' && body.includes('</body>') && !body.includes('id="svDateFormatScript"')) {
      body = body.replace('</head>',style+'</head>').replace('</body>','<script id="svDateFormatScript">'+script+'</script></body>');
    }
    return originalSend.call(this,body);
  };
}

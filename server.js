const express = require('express');

// Inject live deployment information into the shared Supervisor365 sidebar.
// Render exposes the deployed Git SHA as RENDER_GIT_COMMIT.
const originalSend = express.response.send;
const deployedCommit = String(process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'local').slice(0, 8);
const deployedAt = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Brisbane',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
}).format(new Date());

express.response.send = function patchedSend(body) {
  if (typeof body === 'string' && body.includes('</aside>')) {
    const buildInfo = `<div style="position:absolute;left:14px;right:14px;bottom:16px;border-top:1px solid #263449;padding:12px 10px 0;color:#708096;font-size:10px;line-height:1.55"><div style="color:#aeb9c7;font-weight:700">Build ${deployedCommit}</div><div>${deployedAt} AEST</div></div>`;
    body = body.replace('</aside>', buildInfo + '</aside>');
  }
  return originalSend.call(this, body);
};

require('./app-v5.js');

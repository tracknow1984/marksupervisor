const express=require('express');
const ewd=require('./ewd-store');

// EWD PINs are provisioned and reset from the Employee profile.
// Starting a diary only authenticates an existing driver PIN; it never creates one.
const pinRouter=express.Router();
pinRouter.post('/api/ewd/start',(req,res,next)=>{
  try{
    const employeeId=String(req.body?.employeeId||'').trim();
    const pin=String(req.body?.pin||'').trim();
    if(!employeeId)return next();
    if(!ewd.hasPin(employeeId)){
      return res.status(409).json({
        error:'EWD PIN is not configured for this driver. An administrator must set it from Employees → EWD PIN before the diary can start.',
        code:'EWD_PIN_NOT_CONFIGURED'
      });
    }
    if(!/^\d{4,8}$/.test(pin))return res.status(400).json({error:'Enter the driver EWD PIN (4 to 8 digits).',code:'EWD_PIN_REQUIRED'});
    if(req.body)req.body.createPin=false;
    next();
  }catch(e){next(e)}
});

// Safe status check only; PINs, salts and hashes are never returned.
pinRouter.get('/api/ewd/pin-status',(req,res)=>{
  const employeeId=String(req.query?.employeeId||'').trim();
  if(!employeeId)return res.status(400).json({error:'Employee is required'});
  res.set('Cache-Control','no-store');
  res.json({employeeId,hasPin:ewd.hasPin(employeeId)});
});

if(!express.__sv365EwdPinAuthFixed){
  express.__sv365EwdPinAuthFixed=true;
  const previousJson=express.json;
  express.json=function(...args){
    const parser=previousJson(...args);
    return function sv365JsonWithEwdPinFix(req,res,next){
      parser(req,res,err=>err?next(err):pinRouter(req,res,next));
    };
  };
}

if(!express.response.__sv365EwdEmployeePinCopy){
  express.response.__sv365EwdEmployeePinCopy=true;
  const originalSend=express.response.send;
  express.response.send=function(body){
    if(typeof body==='string'&&this?.req?.path==='/ewd'){
      body=body.replace('Create a 4-8 digit EWD PIN. This will be required for future EWD sign-in and daily confirmation.','EWD PIN is not configured for this driver. Ask an administrator to set it from Employees → EWD PIN before starting.');
      body=body.replace('createPin:!selected.hasPin,','createPin:false,');

      // routes/ewd.js is rendered from a normal template literal. In that context
      // \d loses its backslash before the HTML reaches the browser, producing
      // /^d{4,8}$/ instead of /^\d{4,8}$/. Remove the duplicate browser PIN
      // regex entirely and let the shared backend authenticate the employee PIN.
      body=body.split("if(!/^d{4,8}$/.test(pin))return alert('Enter a 4-8 digit EWD PIN.');").join("if(!pin)return alert('Enter your EWD PIN.');");
      body=body.split("if(!/^\\d{4,8}$/.test(pin))return alert('Enter a 4-8 digit EWD PIN.');").join("if(!pin)return alert('Enter your EWD PIN.');");

      // The same template-literal escaping affected the UTC offset parser.
      body=body.split("match(/^([+-])(d{2}):(d{2})$/)").join("match(/^([+-])(\\d{2}):(\\d{2})$/)");
    }
    return originalSend.call(this,body);
  };
}

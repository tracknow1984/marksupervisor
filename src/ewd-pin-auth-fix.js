const express=require('express');
const ewd=require('./ewd-store');

// Make EWD PIN handling deterministic before the EWD router processes Start.
// The server is the source of truth: if the driver has no PIN, the submitted
// 4-8 digit PIN is created immediately; if a PIN already exists, the EWD route
// verifies it normally. This removes any dependency on stale browser createPin state.
const pinRouter=express.Router();
pinRouter.post('/api/ewd/start',(req,res,next)=>{
  try{
    const employeeId=String(req.body?.employeeId||'').trim();
    const pin=String(req.body?.pin||'').trim();
    if(!employeeId)return next();
    if(!/^\d{4,8}$/.test(pin))return res.status(400).json({error:'Enter a 4-8 digit EWD PIN.'});

    if(!ewd.hasPin(employeeId)){
      // Create the first PIN here, before routes/ewd.js runs checkPin().
      // By the time that route executes, hasPin() is true and verifyPin() succeeds.
      ewd.setPin(employeeId,pin);
      req.body.createPin=false;
      req.body.pinAuthMode='CREATED';
    }else{
      req.body.createPin=false;
      req.body.pinAuthMode='VERIFY';
    }
    next();
  }catch(e){next(e)}
});

// Small diagnostic endpoint so the EWD screen can verify PIN state without exposing
// salts, hashes or the PIN itself.
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

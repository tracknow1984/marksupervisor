const express=require('express');
const ewd=require('./ewd-store');

// Normalise EWD PIN authentication immediately before the EWD router handles Start.
// The server is the source of truth for whether a driver is creating a PIN for the
// first time or authenticating with an existing PIN. This prevents a stale browser
// eligibility payload from causing the start sheet to ask for the same PIN twice.
const pinRouter=express.Router();
pinRouter.post('/api/ewd/start',(req,res,next)=>{
  try{
    const employeeId=String(req.body?.employeeId||'').trim();
    if(employeeId&&req.body){
      req.body.createPin=!ewd.hasPin(employeeId);
      req.body.pinAuthMode=req.body.createPin?'CREATE':'VERIFY';
    }
    next();
  }catch(e){next(e)}
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

const express=require('express');
const dashboardRouter=require('./routes/dashboard');

// Mount the dashboard ahead of app-master without disturbing the existing modular route stack.
// This also makes the root URL land on the owner/operations command centre.
const rootRouter=express.Router();
rootRouter.get('/',(req,res)=>res.redirect('/dashboard'));
rootRouter.use(dashboardRouter);

if(!express.__sv365DashboardJsonPatched){
  express.__sv365DashboardJsonPatched=true;
  const originalJson=express.json;
  express.json=function(...args){
    const parser=originalJson(...args);
    return function sv365JsonWithDashboard(req,res,next){
      parser(req,res,err=>err?next(err):rootRouter(req,res,next));
    };
  };
}

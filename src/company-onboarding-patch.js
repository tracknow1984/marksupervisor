const express=require('express');
const companyRouter=require('./routes/company-onboarding');

// Mount the public company registration/authentication layer before app-master.
// This is intentionally isolated from the existing operational routes while the
// legacy fleet modules are migrated to companyId-based tenant filtering.
if(!express.__sv365CompanyOnboarding){
  express.__sv365CompanyOnboarding=true;
  const previousJson=express.json;
  express.json=function(...args){
    const parser=previousJson(...args);
    return function sv365JsonWithCompanyOnboarding(req,res,next){
      parser(req,res,err=>err?next(err):companyRouter(req,res,next));
    };
  };
}

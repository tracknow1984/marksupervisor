const fs=require('fs');
const path=require('path');
const DATA_DIR=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const FILE=path.join(DATA_DIR,'employees.json');
function blank(){return{version:1,employees:[]}}
function ensure(){try{fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(FILE))fs.writeFileSync(FILE,JSON.stringify(blank(),null,2))}catch(e){console.error('Employee store init failed:',e.message)}}
function read(){ensure();try{const d=JSON.parse(fs.readFileSync(FILE,'utf8'));return{version:Number(d.version)||1,employees:Array.isArray(d.employees)?d.employees:[]}}catch(e){console.error('Employee store read failed:',e.message);return blank()}}
function write(data){ensure();const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,FILE)}
function initialise(target){if(!Array.isArray(target))throw new Error('Employee store target must be an array');const saved=read().employees;if(saved.length)target.splice(0,target.length,...saved);else write({version:1,employees:target});return target}
function saveAll(target){if(!Array.isArray(target))throw new Error('Employees must be an array');write({version:1,employees:target});return target}
module.exports={FILE,initialise,saveAll};

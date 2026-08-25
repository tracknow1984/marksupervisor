const fs=require('fs');
const path=require('path');
const dataDir=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const files=['operations.json','incidents.json','services.json','compliance.json','gps-shares.json'];
let removed=0;
for(const name of files){
  const file=path.join(dataDir,name);
  try{
    if(fs.existsSync(file)){fs.rmSync(file,{force:true});removed++}
  }catch(e){
    console.error('Unable to remove '+file+':',e.message);
    process.exitCode=1;
  }
}
console.log('Supervisor365 build data flush complete. Removed '+removed+' data file(s).');
console.log('Set SV365_SAMPLE_DATA=0 before restarting to keep the system empty.');

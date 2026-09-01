const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ui=read('src/routes/prestarts-mobile.js');
const submit=read('src/routes/prestart-submit.js');
const wialon=read('src/prestart-wialon-odometer-patch.js');
const server=read('server.js');

const checks=[
  [ui.includes("router.get('/prestarts'"),'Pre-Start page route is missing'],
  [!ui.includes("router.post('/api/prestarts'"),'Duplicate Pre-Start submit route exists in prestarts-mobile.js'],
  [ui.includes('Fitness for Duty Declaration'),'Fitness for Duty declaration is missing from the source Pre-Start UI'],
  [ui.includes('id=\"prestartEmployee\"'),'Driver / Employee selector is missing from the source Pre-Start UI'],
  [ui.includes('/api/prestarts/wialon-odometer/'),'Wialon odometer integration is missing from the source Pre-Start UI'],
  [submit.includes('fitnessForDutyAccepted!==true'),'Backend Fitness for Duty enforcement is missing'],
  [wialon.includes("unit/update_mileage_counter"),'Wialon odometer write-back endpoint is missing'],
  [!wialon.includes('sv365PrestartWialonOdoScript'),'Wialon backend has regressed to browser UI injection'],
  [!server.includes('prestart-fitness-duty-ui-patch'),'Obsolete Fitness for Duty UI injection is loaded'],
  [!server.includes('prestart-fitness-duty-fix'),'Obsolete reinforced Fitness for Duty injection is loaded']
];

const failed=checks.filter(([ok])=>!ok).map(([,message])=>message);
if(failed.length){
  console.error('Pre-Start source regression check failed:');
  failed.forEach(message=>console.error(' - '+message));
  process.exit(1);
}
console.log('Pre-Start source regression check passed.');

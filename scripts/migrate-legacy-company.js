// Offline, explicit owner assignment. Stop the service and back up SV365_DATA_DIR first.
// Usage: node scripts/migrate-legacy-company.js --company-id CO-... --service-stopped
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const args=process.argv.slice(2),at=args.indexOf('--company-id'),id=at<0?'':args[at+1];
if(!id||!args.includes('--service-stopped'))throw new Error('Provide --company-id and --service-stopped after stopping the service and backing up its data');
const root=path.resolve(process.env.SV365_DATA_DIR||'data');
const auth=JSON.parse(fs.readFileSync(path.join(root,'company-accounts.json'),'utf8'));
const company=auth.companies.find(c=>c.id===id);if(!company)throw new Error('Company account not found. No records were moved.');
const target=path.join(root,'tenants',crypto.createHash('sha256').update(id).digest('hex'));
if(fs.existsSync(target)&&fs.readdirSync(target).length)throw new Error('Target company already has data. Refusing to merge or overwrite it.');
const stage=target+'.migration-'+Date.now();fs.mkdirSync(stage,{recursive:true,mode:0o700});
const files=['operations.json','incidents.json','services.json','compliance.json','gps-shares.json','ewd.json','employee-health.json','geofence-prestart-alerts.json','wialon-prestart.json'];
let copied=0;
for(const name of files){const from=path.join(root,name);if(fs.existsSync(from)){const data=fs.readFileSync(from,'utf8');JSON.parse(data);fs.writeFileSync(path.join(stage,name),data,{mode:0o600});copied++}}
for(const name of ['assets','employees','assetTypes','prestartItems','genericItems','prestartHistory','vehicleDefects']){
 const from=path.join(root,name+'.json');if(!fs.existsSync(from))continue;
 const d=JSON.parse(fs.readFileSync(from,'utf8')),rows=Array.isArray(d)?d:d[name];if(!Array.isArray(rows))throw new Error('Unsupported legacy collection '+name);
 fs.writeFileSync(path.join(stage,'collection-'+name+'.json'),JSON.stringify(rows),{mode:0o600});copied++;
}
const moduleFile=path.join(root,'modules.json');if(fs.existsSync(moduleFile)){const d=JSON.parse(fs.readFileSync(moduleFile,'utf8'));const entry=d.companies?.[id]||d.companies?.default;if(entry){fs.writeFileSync(path.join(stage,'modules.json'),JSON.stringify({version:1,companies:{[id]:entry}}),{mode:0o600});copied++}}
fs.writeFileSync(path.join(stage,'migration.json'),JSON.stringify({companyId:id,migratedAt:new Date().toISOString(),copiedFiles:copied}),{mode:0o600});
if(fs.existsSync(target))fs.rmdirSync(target);fs.renameSync(stage,target);
console.log('Copied '+copied+' legacy files to the confirmed company. Original files remain unchanged.');
console.log('In-memory-only legacy records require an exported snapshot; they cannot be recovered from missing files.');

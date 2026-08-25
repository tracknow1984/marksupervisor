const fs=require('fs');
const path=require('path');
const DATA_DIR=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const FILE=path.join(DATA_DIR,'operations.json');
function blank(){return{prestarts:[],defects:[]}}
function ensure(){try{fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(FILE))fs.writeFileSync(FILE,JSON.stringify(blank(),null,2))}catch(e){console.error('SV365 persistent store init failed:',e.message)}}
function read(){ensure();try{const d=JSON.parse(fs.readFileSync(FILE,'utf8'));return{prestarts:Array.isArray(d.prestarts)?d.prestarts:[],defects:Array.isArray(d.defects)?d.defects:[]}}catch(e){console.error('SV365 persistent store read failed:',e.message);return blank()}}
function write(data){ensure();const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,FILE)}
function listPrestarts(){return read().prestarts}
function getPrestart(id){return listPrestarts().find(x=>String(x.id)===String(id))}
function savePrestart(rec){const d=read();const i=d.prestarts.findIndex(x=>String(x.id)===String(rec.id));if(i>=0)d.prestarts[i]=rec;else d.prestarts.push(rec);write(d);return rec}
function listDefects(){return read().defects}
function saveDefect(rec){const d=read();const i=d.defects.findIndex(x=>String(x.id)===String(rec.id));if(i>=0)d.defects[i]=rec;else d.defects.push(rec);write(d);return rec}
function savePrestartWithDefects(rec,defects){const d=read();if(!d.prestarts.some(x=>String(x.id)===String(rec.id)))d.prestarts.push(rec);for(const defect of defects||[]){if(!d.defects.some(x=>String(x.prestartId)===String(defect.prestartId)&&String(x.prestartItemId)===String(defect.prestartItemId)))d.defects.push(defect)}write(d);return rec}
function updateDefect(id,changes){const d=read();const item=d.defects.find(x=>String(x.id)===String(id));if(!item)return null;Object.assign(item,changes);write(d);return item}
module.exports={FILE,listPrestarts,getPrestart,savePrestart,listDefects,saveDefect,savePrestartWithDefects,updateDefect};

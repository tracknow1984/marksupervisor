const {assets,employees}=require('./store');

const AUTO_DETACH_MS=60*60*1000;
const GPS_FRESH_MS=10*60*1000;
const MOVE_SPEED_KMH=2;
const MOVE_DISTANCE_METRES=50;
const WATCH_INTERVAL_MS=5*60*1000;

function nameOf(employee){
  return [employee?.firstName,employee?.lastName].filter(Boolean).join(' ').trim()||employee?.email||employee?.id||'';
}

function clearEmployeeAsset(employee,{detachedAt='',reason=''}={}){
  if(!employee)return;
  if(employee.currentAssetId){
    employee.lastAssetId=employee.currentAssetId;
    employee.lastAssetName=employee.currentAssetName||'';
    employee.lastAssetRego=employee.currentAssetRego||'';
    employee.lastAssetDetachedAt=detachedAt||new Date().toISOString();
    employee.lastAssetDetachReason=reason||'';
  }
  employee.currentAssetId='';
  employee.currentAssetName='';
  employee.currentAssetRego='';
  employee.currentAssetAssignedAt='';
  employee.currentPrestartId='';
}

function clearAssetDriver(asset,{detachedAt='',reason=''}={}){
  if(!asset)return;
  if(asset.currentDriverEmployeeId){
    asset.lastDriverEmployeeId=asset.currentDriverEmployeeId;
    asset.lastDriverName=asset.currentDriverName||'';
    asset.lastDriverDetachedAt=detachedAt||new Date().toISOString();
    asset.lastDriverDetachReason=reason||'';
  }
  asset.currentDriverEmployeeId='';
  asset.currentDriverName='';
  asset.currentDriverEmail='';
  asset.currentDriverPhone='';
  asset.driverLatchedAt='';
  asset.driverPrestartId='';
  asset.driverStationarySince='';
  asset.driverLastMovedAt='';
  asset.driverLastGpsAt='';
  asset.driverLastGpsLat=null;
  asset.driverLastGpsLon=null;
  asset.driverGpsState='unassigned';
}

function detachDriver(asset,{reason='manual',detachedAt=new Date().toISOString(),expectedEmployeeId=''}={}){
  if(!asset||!asset.currentDriverEmployeeId)return null;
  const employeeId=String(asset.currentDriverEmployeeId);
  if(expectedEmployeeId&&String(expectedEmployeeId)!==employeeId){
    const error=new Error('This employee is no longer assigned to the selected asset');
    error.code='DRIVER_ASSIGNMENT_MISMATCH';
    throw error;
  }
  const snapshot={
    assetId:asset.id,
    assetName:asset.name,
    rego:asset.rego,
    employeeId,
    employeeName:asset.currentDriverName||'',
    assignedAt:asset.driverLatchedAt||'',
    prestartId:asset.driverPrestartId||'',
    detachedAt,
    reason
  };
  const employee=employees.find(e=>String(e.id)===employeeId);
  clearAssetDriver(asset,{detachedAt,reason});
  if(employee&&String(employee.currentAssetId||'')===String(asset.id))clearEmployeeAsset(employee,{detachedAt,reason});
  return snapshot;
}

function latchDriver(asset,employee,prestart){
  if(!asset||!employee||!prestart)return null;
  const assignedAt=prestart.completedAt||new Date().toISOString();
  const priorEmployeeId=String(asset.currentDriverEmployeeId||'');
  if(priorEmployeeId&&priorEmployeeId!==String(employee.id))detachDriver(asset,{reason:'reassigned_to_new_driver',detachedAt:assignedAt});
  for(const other of assets){
    if(String(other.id)!==String(asset.id)&&String(other.currentDriverEmployeeId||'')===String(employee.id)){
      detachDriver(other,{reason:'driver_moved_to_another_asset',detachedAt:assignedAt,expectedEmployeeId:employee.id});
    }
  }
  asset.currentDriverEmployeeId=employee.id;
  asset.currentDriverName=nameOf(employee);
  asset.currentDriverEmail=employee.email||'';
  asset.currentDriverPhone=employee.phone||'';
  asset.driverLatchedAt=assignedAt;
  asset.driverPrestartId=prestart.id||'';
  asset.driverStationarySince='';
  asset.driverLastMovedAt=assignedAt;
  asset.driverLastGpsAt='';
  asset.driverLastGpsLat=null;
  asset.driverLastGpsLon=null;
  asset.driverGpsState='assigned';
  employee.currentAssetId=asset.id;
  employee.currentAssetName=asset.name;
  employee.currentAssetRego=asset.rego;
  employee.currentAssetAssignedAt=assignedAt;
  employee.currentPrestartId=prestart.id||'';
  return {assetId:asset.id,employeeId:employee.id,employeeName:asset.currentDriverName,assignedAt,prestartId:prestart.id||''};
}

function distanceMetres(lat1,lon1,lat2,lon2){
  const toRad=n=>n*Math.PI/180;
  const r=6371000;
  const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*r*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function observeGpsRows(rows,nowMs=Date.now()){
  const detached=[];
  if(!Array.isArray(rows))return detached;
  const byAsset=new Map(rows.map(row=>[String(row.assetId),row]));
  for(const asset of assets){
    if(!asset.currentDriverEmployeeId||!asset.wialonUnitId)continue;
    const row=byAsset.get(String(asset.id));
    const p=row?.unit?.position;
    if(!p){asset.driverGpsState='unavailable';continue;}
    const gpsMs=Number(p.time)*1000;
    const fresh=Number.isFinite(gpsMs)&&gpsMs>0&&gpsMs<=nowMs+60000&&(nowMs-gpsMs)<=GPS_FRESH_MS;
    if(!fresh){asset.driverGpsState='stale';continue;}
    const lat=Number(p.lat),lon=Number(p.lon),speed=Number(p.speed)||0;
    const prevLat=Number(asset.driverLastGpsLat),prevLon=Number(asset.driverLastGpsLon);
    const hasPrevious=Number.isFinite(prevLat)&&Number.isFinite(prevLon);
    const movedDistance=hasPrevious&&Number.isFinite(lat)&&Number.isFinite(lon)?distanceMetres(prevLat,prevLon,lat,lon):0;
    const moved=speed>MOVE_SPEED_KMH||movedDistance>=MOVE_DISTANCE_METRES;
    const gpsIso=new Date(gpsMs).toISOString();
    asset.driverLastGpsAt=gpsIso;
    if(Number.isFinite(lat))asset.driverLastGpsLat=lat;
    if(Number.isFinite(lon))asset.driverLastGpsLon=lon;
    if(moved){
      asset.driverGpsState='moving';
      asset.driverLastMovedAt=gpsIso;
      asset.driverStationarySince='';
      continue;
    }
    asset.driverGpsState='stationary';
    if(!asset.driverStationarySince){
      asset.driverStationarySince=gpsIso;
      continue;
    }
    const stationarySinceMs=new Date(asset.driverStationarySince).getTime();
    if(Number.isFinite(stationarySinceMs)&&nowMs-stationarySinceMs>=AUTO_DETACH_MS){
      const released=detachDriver(asset,{reason:'gps_stationary_60m',detachedAt:new Date(nowMs).toISOString()});
      if(released)detached.push(released);
    }
  }
  return detached;
}

let watchBusy=false;
async function runGpsDriverWatch(){
  if(watchBusy)return;
  watchBusy=true;
  try{
    const port=process.env.PORT||3000;
    const r=await fetch(`http://127.0.0.1:${port}/api/gps/live`,{headers:{'X-Supervisor365-Internal':'driver-assignment-watch'}});
    if(!r.ok)return;
    const rows=await r.json();
    const detached=observeGpsRows(rows);
    if(detached.length)console.log('Supervisor365 auto-detached drivers:',detached.map(x=>`${x.employeeName||x.employeeId} from ${x.rego||x.assetName}`).join(', '));
  }catch(e){
    if(!/ECONNREFUSED|fetch failed/i.test(String(e.message||'')))console.warn('Driver GPS assignment watch failed:',e.message);
  }finally{
    watchBusy=false;
  }
}

const watchTimer=setInterval(runGpsDriverWatch,WATCH_INTERVAL_MS);
if(watchTimer.unref)watchTimer.unref();
const firstWatch=setTimeout(runGpsDriverWatch,60000);
if(firstWatch.unref)firstWatch.unref();

module.exports={latchDriver,detachDriver,clearAssetDriver,clearEmployeeAsset,nameOf,observeGpsRows,runGpsDriverWatch,AUTO_DETACH_MS};

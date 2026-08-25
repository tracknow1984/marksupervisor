const {assets,employees}=require('./store');

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

module.exports={latchDriver,detachDriver,clearAssetDriver,clearEmployeeAsset,nameOf};

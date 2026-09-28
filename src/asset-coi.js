// Fleet defaults can be overridden on each asset; these are not a legal classification.
function requiresCoi(asset){
 if(typeof asset.coiRequired==='boolean')return asset.coiRequired;
 const type=String(asset.type||'').trim().toLowerCase();
 return !['light vehicle','car','motorcycle','ute','utility','van','light commercial vehicle'].includes(type);
}
module.exports={requiresCoi};

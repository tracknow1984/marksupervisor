// Mutable legacy collections are persisted inside the one-company worker directory.
const fs=require('fs');
const path=require('path');
const mutators=new Set(['copyWithin','fill','pop','push','reverse','shift','sort','splice','unshift']);
function collection(name,defaults=[]){
  if(!process.env.SV365_TENANT_ID)throw new Error('Operational storage requires a company worker');
  const dir=process.env.SV365_DATA_DIR;
  if(!dir)throw new Error('Company storage directory is missing');
  const file=path.join(dir,'collection-'+name+'.json');fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const raw=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):structuredClone(defaults);
  if(!Array.isArray(raw))throw new Error('Invalid company collection: '+name);
  const cache=new WeakMap(),originals=new WeakMap();let depth=0,dirty=false;
  function save(){dirty=true;if(depth)return;const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(raw),{mode:0o600});fs.renameSync(tmp,file);dirty=false}
  function wrap(value){
    if(!value||typeof value!=='object')return value;
    if(cache.has(value))return cache.get(value);
    const proxy=new Proxy(value,{
      get(target,key,receiver){
        if(Array.isArray(target)&&mutators.has(key))return(...args)=>{depth++;try{return Array.prototype[key].apply(receiver,args)}finally{depth--;if(dirty)save()}};
        return wrap(Reflect.get(target,key,receiver));
      },
      set(target,key,v){const ok=Reflect.set(target,key,originals.get(v)||v);save();return ok},
      deleteProperty(target,key){const ok=Reflect.deleteProperty(target,key);save();return ok}
    });cache.set(value,proxy);cache.set(proxy,proxy);originals.set(proxy,value);return proxy;
  }
  return wrap(raw);
}
module.exports={collection};

const express=require('express');
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {fork}=require('child_process');
const accounts=require('./company-account-store');
const companyRouter=require('./routes/company-onboarding');
const ROOT=path.resolve(process.env.SV365_DATA_DIR||path.join(process.cwd(),'data'));
function tenantDirectory(companyId){
  if(typeof companyId!=='string'||!companyId)throw new Error('Company identity is required');
  return path.join(ROOT,'tenants',crypto.createHash('sha256').update(companyId).digest('hex'));
}
function session(req){
  try{const part=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sv365_session='));return part?accounts.getSession(decodeURIComponent(part.slice(14))):null}catch{return null}
}
function createPool(){
  const workers=new Map();const maximum=Math.max(1,Math.min(32,Number(process.env.SV365_MAX_TENANT_WORKERS)||4));
  async function stop(entry){
    if(!entry)return;entry.stopping=true;
    await new Promise(resolve=>{if(entry.child.exitCode!==null)return resolve();const timer=setTimeout(()=>entry.child.kill('SIGKILL'),5000);entry.child.once('exit',()=>{clearTimeout(timer);resolve()});entry.child.kill('SIGTERM')});
    if(workers.get(entry.id)===entry)workers.delete(entry.id);
  }
  function monitoring(entry){try{const job=JSON.parse(fs.readFileSync(path.join(entry.dir,'rego-bulk.json'),'utf8'));if(['running','pausing'].includes(job.state))return true}catch(e){if(e.code!=='ENOENT')return true}try{const d=JSON.parse(fs.readFileSync(path.join(entry.dir,'geofence-prestart-alerts.json'),'utf8'));return(d.rules||[]).some(r=>r.enabled!==false)}catch(e){return e.code!=='ENOENT'}}
  async function acquire(id){
    let entry=workers.get(id);
    if(entry&&!entry.stopping){entry.active++;try{await entry.ready;return entry}catch(e){entry.active--;throw e}}
    if(workers.size>=maximum){const idle=[...workers.values()].filter(w=>!w.active&&!w.stopping&&!monitoring(w)).sort((a,b)=>a.used-b.used)[0];if(!idle){const e=new Error('Company workspaces are busy. Please try again shortly.');e.status=503;throw e}await stop(idle)}
    // Recheck after awaiting eviction to avoid creating two writers for one company.
    entry=workers.get(id);if(entry&&!entry.stopping)return acquire(id);
    const dir=tenantDirectory(id);fs.mkdirSync(dir,{recursive:true,mode:0o700});
    // Explicit environment allowlist: never inherit a fleet token or account-store secrets.
    const env={};for(const key of ['PATH','NODE_PATH','NODE_ENV','TZ','LANG','HOME','TMPDIR','HTTP_PROXY','HTTPS_PROXY','NO_PROXY','http_proxy','https_proxy','no_proxy','RENDER_GIT_COMMIT','APP_PUBLIC_URL','SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASS','SMTP_FROM','MAIL_FROM'])if(process.env[key]!==undefined)env[key]=process.env[key];
    Object.assign(env,{PORT:'0',SV365_TENANT_ID:id,SV365_DATA_DIR:dir,SV365_SAMPLE_DATA:'0'});
    const child=fork(path.join(__dirname,'..','operations-app.js'),[],{env,cwd:path.join(__dirname,'..'),stdio:['ignore','ignore','inherit','ipc']});
    entry={id,dir,child,port:null,active:1,used:Date.now(),stopping:false};workers.set(id,entry);
    entry.ready=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('Company workspace startup timed out'))},20000);child.once('error',e=>{clearTimeout(timeout);reject(e)});child.on('message',m=>{if(m?.type==='ready'&&Number.isInteger(m.port)&&m.port>0){clearTimeout(timeout);entry.port=m.port;resolve()}});child.once('exit',()=>{clearTimeout(timeout);if(workers.get(id)===entry)workers.delete(id);reject(new Error('Company workspace stopped'))})});
    try{await entry.ready;return entry}catch(e){entry.active--;throw e}
  }
  // Serialise provisioning, not requests. One process is the sole writer for a company.
  let provisioning=Promise.resolve();
  function get(id){const result=provisioning.then(()=>acquire(id));provisioning=result.catch(()=>{});return result}
  return{get,release(entry){entry.active=Math.max(0,entry.active-1);entry.used=Date.now()},async close(){await Promise.all([...workers.values()].map(stop))},workers};
}
function createGateway(){
  let regoBusyUntil=0;
  const app=express(),pool=createPool();app.disable('x-powered-by');app.set('trust proxy',1);
  app.use((req,res,next)=>{res.set('Cache-Control','private, no-store');res.set('Vary','Cookie');res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','same-origin');res.set('X-Frame-Options','SAMEORIGIN');next()});
  app.get('/healthz',(req,res)=>res.json({ok:true,companyIsolation:true}));
  // Keep the migration preview read-only until durable storage is attached.
  app.use((req,res,next)=>{
    if(process.env.SV365_MIGRATION_PREVIEW==='1'&&!['GET','HEAD','OPTIONS'].includes(req.method))return res.status(503).json({error:'This workspace is being prepared. Account creation and changes will open after permanent storage is connected.',code:'MIGRATION_PREVIEW'});
    next();
  });
  app.use((req,res,next)=>{
    if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
      if(req.get('Sec-Fetch-Site')==='cross-site')return res.status(403).json({error:'Cross-site requests are not allowed'});
      if(req.get('Origin')){try{if(new URL(req.get('Origin')).host!==req.get('Host'))return res.status(403).json({error:'Request origin does not match'})}catch{return res.status(403).json({error:'Invalid request origin'})}}
    }
    next();
  });
  const authParser=express.json({limit:'128kb'});
  app.use((req,res,next)=>{
    const accountRoute=['/signup','/login','/onboarding','/client-logo','/api/profile','/api/public/abn-lookup','/api/public/company-signup'].includes(req.path)||/^\/api\/(auth|company)(\/|$)/i.test(req.path);
    if(!accountRoute)return next();
    authParser(req,res,err=>err?next(err):companyRouter(req,res,()=>res.status(404).json({error:'Account endpoint not found'})));
  });
  app.use(async(req,res)=>{
    const ctx=session(req);
    if(!ctx)return req.path.startsWith('/api/')?res.status(401).json({error:'Sign in required',code:'AUTH_REQUIRED'}):res.redirect('/login');
    if(ctx.user.mustChangePassword)return req.path.startsWith('/api/')?res.status(403).json({error:'Change your temporary password first',code:'PASSWORD_CHANGE_REQUIRED'}):res.redirect('/onboarding?changePassword=1');
    // Company identity comes exclusively from the authenticated session, never a URL/body/header.
    if(req.method!=='GET'&&req.method!=='HEAD'&&(/^\/api\/modules(?:\/|$)/.test(req.path)||req.path==='/api/gps/wialon/token')&&!['Owner','Company Admin'].includes(ctx.user.role))return res.status(403).json({error:'Company administrator access required'});
    if(req.method==='POST'&&/^\/api\/assets\/[^/]+\/check-registration$/.test(req.path)){
      if(!['Owner','Company Admin'].includes(ctx.user.role))return res.status(403).json({error:'Company administrator access required'});
      if(Date.now()<regoBusyUntil)return res.status(429).json({error:'Another registration check is running or has just finished. Please try again shortly.'});
      regoBusyUntil=Date.now()+90000;
      res.once('finish',()=>{regoBusyUntil=Date.now()+10000});
    }
    let entry;
    try{
      entry=await pool.get(ctx.company.id);if(res.destroyed){pool.release(entry);return}let released=false;const release=()=>{if(!released){released=true;pool.release(entry)}};
      res.once('close',release);res.once('finish',release);
      const headers={...req.headers};for(const key of Object.keys(headers))if(key==='cookie'||key==='authorization'||key==='connection'||key.startsWith('x-sv365')||key.startsWith('x-supervisor')||key.startsWith('x-forwarded'))delete headers[key];
      headers['x-forwarded-proto']=req.protocol;headers['x-sv365-user-role']=ctx.user.role;headers['x-sv365-company-name']=encodeURIComponent(ctx.company.name);headers['x-sv365-user-name']=encodeURIComponent([ctx.user.firstName,ctx.user.lastName].filter(Boolean).join(' '));
      const upstream=http.request({hostname:'127.0.0.1',port:entry.port,path:req.originalUrl,method:req.method,headers},response=>{
        res.status(response.statusCode);for(const [key,value] of Object.entries(response.headers))if(value!==undefined&&!['set-cookie','connection','transfer-encoding','cache-control','vary'].includes(key))res.setHeader(key,value);
        res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');response.pipe(res);
        response.on('error',()=>res.destroy());
      });
      upstream.setTimeout(90000,()=>upstream.destroy(new Error('Workspace request timed out')));
      upstream.on('error',()=>{release();if(!res.headersSent)res.status(502).json({error:'Company workspace is temporarily unavailable'});else res.destroy()});
      res.once('close',()=>upstream.destroy());req.pipe(upstream);
    }catch(e){if(entry)pool.release(entry);if(!res.headersSent)res.status(e.status||503).json({error:'Company workspace is temporarily unavailable. Please try again.'})}
  });
  app.use((err,req,res,next)=>{if(res.headersSent)return next(err);res.status(err.status||500).json({error:err.type==='entity.too.large'?'Request is too large':'Unable to complete this request'})});
  return{app,pool};
}
function start(){const {app,pool}=createGateway();const server=app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Supervisor365 company gateway ready'));let stopping=false;const close=()=>{if(stopping)return;stopping=true;server.close(async()=>{await pool.close();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref()};process.on('SIGTERM',close);process.on('SIGINT',close);return{server,pool}}
module.exports={createGateway,start,tenantDirectory};

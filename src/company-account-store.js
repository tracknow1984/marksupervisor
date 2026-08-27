const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const DATA_DIR=process.env.SV365_DATA_DIR||path.join(process.cwd(),'data');
const FILE=path.join(DATA_DIR,'company-accounts.json');
const SESSION_MS=12*60*60*1000;
const CHALLENGE_MS=10*60*1000;

function blank(){return{version:1,companies:[],users:[],sessions:[],challenges:[]}}
function ensure(){fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(FILE))fs.writeFileSync(FILE,JSON.stringify(blank(),null,2))}
function read(){ensure();try{const d=JSON.parse(fs.readFileSync(FILE,'utf8'));return{version:Number(d.version)||1,companies:Array.isArray(d.companies)?d.companies:[],users:Array.isArray(d.users)?d.users:[],sessions:Array.isArray(d.sessions)?d.sessions:[],challenges:Array.isArray(d.challenges)?d.challenges:[]}}catch(e){console.error('Company account store read failed:',e.message);return blank()}}
function write(d){ensure();const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(d,null,2));fs.renameSync(tmp,FILE)}
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).toLowerCase();
const id=(prefix)=>prefix+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(4).toString('hex').toUpperCase();
const token=()=>crypto.randomBytes(32).toString('base64url');
const tokenHash=v=>crypto.createHash('sha256').update(String(v||'')).digest('hex');

function hashPassword(password){const value=String(password||'');if(value.length<10)throw new Error('Password must be at least 10 characters');const salt=crypto.randomBytes(16).toString('hex');const hash=crypto.scryptSync(value,salt,32).toString('hex');return{salt,hash,algorithm:'scrypt',updatedAt:new Date().toISOString()}}
function verifyPassword(password,record){if(!record?.salt||!record?.hash)return false;try{const a=Buffer.from(record.hash,'hex');const b=crypto.scryptSync(String(password||''),record.salt,a.length);return a.length===b.length&&crypto.timingSafeEqual(a,b)}catch{return false}}
function publicCompany(c){if(!c)return null;return{id:c.id,name:c.name,abn:c.abn,abnStatus:c.abnStatus||'',businessType:c.businessType,status:c.status,contactName:c.contactName,contactEmail:c.contactEmail,accountsContact:c.accountsContact,accountsEmail:c.accountsEmail||'',accountsPhone:c.accountsPhone,createdAt:c.createdAt,activatedAt:c.activatedAt,sso:c.sso||{}}}
function publicUser(u){if(!u)return null;return{id:u.id,companyId:u.companyId,username:u.username,email:u.email,firstName:u.firstName,lastName:u.lastName,phone:u.phone||'',role:u.role,status:u.status,mustChangePassword:!!u.mustChangePassword,mfa:{enabled:!!u.mfa?.enabled,method:u.mfa?.enabled?'totp':''},identityProviders:Array.isArray(u.identityProviders)?u.identityProviders:[],createdAt:u.createdAt,lastLoginAt:u.lastLoginAt||null}}
function listCompanies(){return read().companies.map(publicCompany)}
function getCompany(companyId){return publicCompany(read().companies.find(x=>String(x.id)===String(companyId)))}
function getUser(userId){return publicUser(read().users.find(x=>String(x.id)===String(userId)))}
function getRawUser(userId){return read().users.find(x=>String(x.id)===String(userId))||null}
function listCompanyUsers(companyId){return read().users.filter(x=>String(x.companyId)===String(companyId)).map(publicUser)}
function findUserForLogin(login){const key=norm(login);return read().users.find(u=>norm(u.username)===key||norm(u.email)===key)||null}
function usernameExists(username){const key=norm(username);return read().users.some(u=>norm(u.username)===key)}
function emailExists(email){const key=norm(email);return read().users.some(u=>norm(u.email)===key)}
function abnExists(abn){const key=clean(abn).replace(/\D/g,'');return read().companies.some(c=>String(c.abn).replace(/\D/g,'')===key)}

function createCompanySignup(input){
  const companyName=clean(input.companyName),abn=clean(input.abn).replace(/\D/g,''),contactName=clean(input.contactName),contactEmail=norm(input.contactEmail),accountsContact=clean(input.accountsContact),accountsEmail=norm(input.accountsEmail),accountsPhone=clean(input.accountsPhone),businessType=clean(input.businessType),username=norm(input.username),password=String(input.password||'');
  if(!companyName||!abn||!contactName||!contactEmail||!accountsContact||!accountsPhone||!businessType||!username)throw new Error('Complete all required company signup fields');
  if(abnExists(abn))throw new Error('A Supervisor365 company account already exists for this ABN');
  if(usernameExists(username))throw new Error('That username is already in use');
  if(emailExists(contactEmail))throw new Error('That contact email is already linked to an account');
  const now=new Date().toISOString(),companyId=id('CO'),userId=id('USR');
  const company={id:companyId,name:companyName,abn,abnStatus:clean(input.abnStatus),abnLookupVerified:!!input.abnLookupVerified,businessType,contactName,contactEmail,accountsContact,accountsEmail,accountsPhone,status:'ACTIVE',createdAt:now,activatedAt:now,onboarding:{companyProfile:true,employees:false,security:false,integrations:false},sso:{enabled:false,mode:'OPTIONAL',providers:{microsoft:{enabled:false},google:{enabled:false},passkey:{enabled:false}}}};
  const parts=contactName.split(/\s+/),user={id:userId,companyId,username,email:contactEmail,firstName:parts.shift()||contactName,lastName:parts.join(' '),phone:'',role:'Company Admin',status:'ACTIVE',password:hashPassword(password),mustChangePassword:false,mfa:{enabled:false,method:'totp',secretEnc:'',pendingSecretEnc:''},identityProviders:[],createdAt:now,updatedAt:now,lastLoginAt:null};
  const d=read();d.companies.push(company);d.users.push(user);write(d);return{company:publicCompany(company),user:publicUser(user)};
}

function createSession(userId,meta={}){const d=read(),u=d.users.find(x=>String(x.id)===String(userId));if(!u||u.status!=='ACTIVE')throw new Error('Account is not active');const raw=token(),now=Date.now();d.sessions=d.sessions.filter(s=>new Date(s.expiresAt).getTime()>now);d.sessions.push({id:id('SES'),tokenHash:tokenHash(raw),userId:u.id,companyId:u.companyId,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+SESSION_MS).toISOString(),ip:clean(meta.ip),userAgent:clean(meta.userAgent)});u.lastLoginAt=new Date(now).toISOString();u.updatedAt=u.lastLoginAt;write(d);return{token:raw,expiresAt:new Date(now+SESSION_MS).toISOString(),user:publicUser(u)}}
function getSession(raw){if(!raw)return null;const d=read(),now=Date.now(),hash=tokenHash(raw),s=d.sessions.find(x=>x.tokenHash===hash&&new Date(x.expiresAt).getTime()>now);if(!s)return null;const u=d.users.find(x=>String(x.id)===String(s.userId)),c=d.companies.find(x=>String(x.id)===String(s.companyId));if(!u||u.status!=='ACTIVE'||!c||c.status!=='ACTIVE')return null;return{session:{...s,tokenHash:undefined},user:publicUser(u),company:publicCompany(c)}}
function revokeSession(raw){const d=read(),hash=tokenHash(raw),before=d.sessions.length;d.sessions=d.sessions.filter(x=>x.tokenHash!==hash);if(d.sessions.length!==before)write(d);return true}
function verifyUserPassword(userId,password){const u=getRawUser(userId);return !!u&&verifyPassword(password,u.password)}
function changePassword(userId,password){const d=read(),u=d.users.find(x=>String(x.id)===String(userId));if(!u)throw new Error('User not found');u.password=hashPassword(password);u.mustChangePassword=false;u.updatedAt=new Date().toISOString();write(d);return publicUser(u)}

function uniqueUsername(base,d){let candidate=norm(base).replace(/[^a-z0-9._-]/g,'');if(!candidate)candidate='user';let n=1,original=candidate;while(d.users.some(u=>norm(u.username)===candidate)){candidate=original+(++n)}return candidate}
function temporaryPassword(){return 'S'+crypto.randomBytes(9).toString('base64url').replace(/[-_]/g,'7')+'9!'}
function createEmployeeUser(companyId,input){const d=read(),company=d.companies.find(c=>String(c.id)===String(companyId));if(!company)throw new Error('Company not found');const firstName=clean(input.firstName),lastName=clean(input.lastName),email=norm(input.email),phone=clean(input.phone),role=clean(input.role)||'Driver';if(!firstName||!lastName||!email)throw new Error('Employee first name, last name and email are required');if(d.users.some(u=>norm(u.email)===email))throw new Error('That employee email already has a Supervisor365 account');const temp=temporaryPassword(),now=new Date().toISOString(),username=uniqueUsername(clean(input.username)||email.split('@')[0],d);const user={id:id('USR'),companyId:company.id,username,email,firstName,lastName,phone,role,status:'ACTIVE',password:hashPassword(temp),mustChangePassword:true,mfa:{enabled:false,method:'totp',secretEnc:'',pendingSecretEnc:''},identityProviders:[],createdAt:now,updatedAt:now,lastLoginAt:null};d.users.push(user);company.onboarding=company.onboarding||{};company.onboarding.employees=true;write(d);return{user:publicUser(user),temporaryPassword:temp,company:publicCompany(company)}}
function updateUserProfile(userId,input){const d=read(),u=d.users.find(x=>String(x.id)===String(userId));if(!u)throw new Error('User not found');for(const k of ['firstName','lastName','phone'])if(k in input)u[k]=clean(input[k]);u.updatedAt=new Date().toISOString();write(d);return publicUser(u)}

function authKey(){const raw=clean(process.env.SV365_AUTH_ENCRYPTION_KEY);if(!raw)return null;return crypto.createHash('sha256').update(raw).digest()}
function encryptSecret(value){const key=authKey();if(!key)throw new Error('SV365_AUTH_ENCRYPTION_KEY must be configured before enabling 2FA');const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const enc=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]),tag=cipher.getAuthTag();return[iv.toString('base64url'),tag.toString('base64url'),enc.toString('base64url')].join('.')}
function decryptSecret(value){const key=authKey();if(!key||!value)return'';try{const[iv,tag,data]=String(value).split('.').map(x=>Buffer.from(x,'base64url'));const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8')}catch{return''}}
function setPendingMfa(userId,secret){const d=read(),u=d.users.find(x=>String(x.id)===String(userId));if(!u)throw new Error('User not found');u.mfa=u.mfa||{};u.mfa.pendingSecretEnc=encryptSecret(secret);u.mfa.method='totp';u.updatedAt=new Date().toISOString();write(d);return true}
function getPendingMfaSecret(userId){const u=getRawUser(userId);return decryptSecret(u?.mfa?.pendingSecretEnc)}
function enableMfa(userId){const d=read(),u=d.users.find(x=>String(x.id)===String(userId));if(!u?.mfa?.pendingSecretEnc)throw new Error('No pending 2FA setup');u.mfa.secretEnc=u.mfa.pendingSecretEnc;u.mfa.pendingSecretEnc='';u.mfa.enabled=true;u.mfa.method='totp';u.updatedAt=new Date().toISOString();const c=d.companies.find(x=>String(x.id)===String(u.companyId));if(c){c.onboarding=c.onboarding||{};c.onboarding.security=true}write(d);return publicUser(u)}
function getMfaSecret(userId){const u=getRawUser(userId);return u?.mfa?.enabled?decryptSecret(u.mfa.secretEnc):''}

function createChallenge(userId){const d=read(),u=d.users.find(x=>String(x.id)===String(userId));if(!u)throw new Error('User not found');const raw=token(),now=Date.now();d.challenges=d.challenges.filter(c=>new Date(c.expiresAt).getTime()>now);d.challenges.push({tokenHash:tokenHash(raw),userId:u.id,companyId:u.companyId,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+CHALLENGE_MS).toISOString()});write(d);return raw}
function consumeChallenge(raw){const d=read(),hash=tokenHash(raw),now=Date.now(),i=d.challenges.findIndex(c=>c.tokenHash===hash&&new Date(c.expiresAt).getTime()>now);if(i<0)return null;const c=d.challenges[i];d.challenges.splice(i,1);write(d);return c}

module.exports={FILE,createCompanySignup,listCompanies,getCompany,getUser,getRawUser,listCompanyUsers,findUserForLogin,verifyUserPassword,createSession,getSession,revokeSession,changePassword,createEmployeeUser,updateUserProfile,setPendingMfa,getPendingMfaSecret,enableMfa,getMfaSecret,createChallenge,consumeChallenge,publicUser,publicCompany};

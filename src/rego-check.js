const crypto = require('node:crypto');
const SOURCE = 'https://www.service.transport.qld.gov.au/checkrego/public/Welcome.xhtml';
const TERMS = 'https://www.qld.gov.au/transport/terms-check-rego';
const normal = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
class CheckError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function dateISO(value) {
  const m = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) throw new CheckError('review', 'TMR returned an unrecognised expiry date. Existing details were kept.');
  const iso = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  const d = new Date(iso + 'T00:00:00Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== iso) throw new CheckError('review','TMR returned an invalid expiry date.');
  return iso;
}
// Read labelled, rendered result text only. Never use a date or VIN from elsewhere on the page.
function parseResult(text) {
  const lines = String(text).split(/[\n\t]+/).map(x => x.trim()).filter(Boolean);
  function field(labels) {
    for (let i=0;i<lines.length;i++) for (const label of labels) {
      if (lines[i].replace(/:$/,'').toLowerCase() === label.toLowerCase()) return lines[i+1] || '';
      const prefix = label + ':';
      if (lines[i].toLowerCase().startsWith(prefix.toLowerCase())) return lines[i].slice(prefix.length).trim();
    }
    return '';
  }
  const rego = field(['Registration number','Registration']);
  const vin = field(['VIN','Vehicle identification number']);
  const chassis = field(['Chassis number','Chassis']);
  const status = field(['Registration status','Status']).toUpperCase();
  const expiry = field(['Registration expiry date','Registration expiry','Expiry date','Expiry']);
  if (!rego || !['REGISTERED','CURRENT','EXPIRED','UNREGISTERED','SUSPENDED','CANCELLED'].includes(status) || !expiry) {
    throw new CheckError('review','No complete registration result was returned. Check the official website; existing details were kept.');
  }
  return {rego:normal(rego),vin:normal(vin),chassis:normal(chassis),status,expiry:dateISO(expiry),
    description:field(['Vehicle description','Description']).slice(0,300),
    inspectionWarning:/current inspection not recorded/i.test(text)?'Current Inspection not recorded':''};
}
function assetIdentity(asset) {
  const vin = normal(asset.vin);
  const serial = String(asset.serialNumber ?? asset.importSource?.serial ?? '').trim();
  const labelled = serial.match(/^(?:VIN|CHASSIS(?: NUMBER)?|SERIAL(?: NUMBER)?)\s*:\s*([A-Z0-9-]+)$/i);
  const chassis = normal(labelled ? labelled[1] : /^[A-Z0-9-]{4,25}$/i.test(serial) ? serial : '');
  return {rego:normal(asset.rego),state:String(asset.registrationState||'').toUpperCase(),vin,chassis};
}
function matchVehicle(asset, result) {
  const id = assetIdentity(asset);
  if (id.rego !== result.rego) throw new CheckError('review','Returned registration does not match this asset. Existing details were kept.');
  if (id.vin && result.vin && id.vin !== result.vin) throw new CheckError('review','Returned VIN does not match this asset. Existing details were kept.');
  if (id.vin && (id.vin === result.vin || id.vin === result.chassis)) return 'VIN';
  if (id.vin) throw new CheckError('review','Returned vehicle identity does not match the recorded VIN. Existing details were kept.');
  if (id.chassis && (id.chassis === result.chassis || id.chassis === result.vin)) return 'Chassis / serial';
  throw new CheckError('review','VIN/chassis could not be matched. Confirm the vehicle identity in Asset Details and check again. Existing details were kept.');
}
function guardText(text) {
  if (/verify (?:that )?you are human|checking your browser|unusual traffic|automated queries|access denied|request blocked/i.test(text))
    throw new CheckError('blocked','TMR requires a manual check or has blocked this request. Open the official checker. Existing details were kept.');
}
const stages={runtime:'Starting registration browser',welcome:'Opening Queensland Transport',terms:'Opening TMR terms',accept:'Accepting TMR terms',form:'Entering registration',search:'Searching TMR',result:'Reading registration result'};
async function lookup(rego,onProgress=()=>{}) {
  let browser, page, timer, stage='runtime';
  const progress=next=>{stage=next;onProgress(stages[next])};
  try {
    progress('runtime');
    const {chromium: playwright} = require('playwright-core');
    const chromium = (await import('@sparticuz/chromium')).default;
    browser = await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(arg=>!/^--(?:allow-running-insecure-content|disable-web-security|disable-site-isolation-trials|disable-features)/.test(arg)),headless:true,timeout:20000});
    timer = setTimeout(()=>browser.close().catch(()=>{}),55000);
    page = await browser.newPage({locale:'en-AU'});
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(20000);
    progress('welcome');
    const response=await page.goto(SOURCE,{waitUntil:'domcontentloaded'});
    if(response && response.status()>=400)throw new CheckError('upstream','TMR returned HTTP '+response.status()+'. No registration details were changed.');
    guardText(await page.locator('body').innerText());
    progress('terms');
    await page.getByRole('button',{name:'Continue',exact:true}).or(page.getByRole('link',{name:'Continue',exact:true})).click();
    progress('accept');
    await page.getByRole('button',{name:'Accept',exact:true}).click();
    guardText(await page.locator('body').innerText());
    progress('form');
    await page.getByRole('textbox',{name:/^Registration number/}).fill(rego);
    progress('search');
    await page.getByRole('main').getByRole('button',{name:'Search',exact:true}).click();
    progress('result');
    // TMR's Status term contains trailing newlines/tabs: an anchored text regex never matches it.
    // Wait for the accessible result heading, then parse the rendered labelled values.
    await page.getByRole('main').getByRole('heading',{name:'Registration details',exact:true}).waitFor({state:'visible',timeout:20000});
    const text = await page.getByRole('main').innerText();
    guardText(text);
    return parseResult(text);
  } catch (e) {
    // Log stage and exception type; only browser-start errors include text, before any fleet data is entered.
    console.error(JSON.stringify({event:'rego_lookup_failed',stage,error:e.name,code:e.code||'',...(stage==='runtime'?{detail:String(e.message).slice(0,1600)}:{})}));
    if(e instanceof CheckError){e.stage=stage;throw e}
    const failure=new CheckError('unavailable',stages[stage]+' failed. Existing registration details were kept. Reference: '+stage+'.');
    failure.stage=stage;throw failure;
  } finally {
    clearTimeout(timer);
    if (browser) await browser.close().catch(()=>{});
  }
}
function createChecker(assets, provider=lookup) {
  let busy = false;
  return async function check(id, user) {
    const index = assets.findIndex(a=>a.id===id);
    if (index<0) throw new CheckError('missing','Asset not found');
    const asset = assets[index], identity = assetIdentity(asset);
    if (!/^[A-Z0-9]{1,10}$/.test(identity.rego)) throw new CheckError('invalid','Add a valid registration number before checking.');
    if (identity.state && identity.state!=='QLD') throw new CheckError('invalid','This asset is registered outside Queensland.');
    if (busy) throw new CheckError('busy','A registration check is already running. Please wait.');
    if (Date.now()-Date.parse(asset.registrationCheck?.attemptedAt||'')<60000) throw new CheckError('busy','Wait one minute before checking this asset again.');
    busy=true;
    const attempt={id:crypto.randomUUID(),attemptedAt:new Date().toISOString(),by:String(user||'Company administrator'),source:SOURCE,terms:TERMS};
    const snapshot=JSON.stringify([identity,asset.registrationExpiry,asset.registrationStatus]);
    try {
      const report=message=>{const i=assets.findIndex(a=>a.id===id);if(i>=0)assets[i]={...assets[i],registrationCheck:{...attempt,state:'running',message}}};
      report('Starting registration check');
      const result=await provider(identity.rego,report);
      const currentIndex=assets.findIndex(a=>a.id===id);
      if(currentIndex<0)throw new CheckError('missing','Asset no longer exists');
      const current=assets[currentIndex];
      if(snapshot!==JSON.stringify([assetIdentity(current),current.registrationExpiry,current.registrationStatus]))throw new CheckError('review','Asset details changed during this check. Existing details were kept; check again.');
      const matchedBy=matchVehicle(current,result), checkedAt=new Date().toISOString();
      const record={...attempt,state:'verified',checkedAt,matchedBy,result,previous:{registrationState:current.registrationState||'',registrationExpiry:current.registrationExpiry||'',registrationStatus:current.registrationStatus||'',registrationInspectionWarning:current.registrationInspectionWarning||''}};
      // Replace the collection item once: the tenant collection saves this atomically.
      assets[currentIndex]={...current,registrationState:'QLD',registrationExpiry:result.expiry,registrationStatus:result.status,registrationInspectionWarning:result.inspectionWarning,registrationCheckedAt:checkedAt,registrationCheck:record,registrationCheckHistory:[...(current.registrationCheckHistory||[]),record].slice(-20)};
      return {ok:true,check:record,asset:assets[currentIndex]};
    } catch(e) {
      const currentIndex=assets.findIndex(a=>a.id===id);
      const record={...attempt,state:e.code||'unavailable',stage:e.stage||'',message:e instanceof CheckError?e.message:'The check failed. Existing details were kept.'};
      if(currentIndex>=0){const current=assets[currentIndex];assets[currentIndex]={...current,registrationCheck:record,registrationCheckHistory:[...(current.registrationCheckHistory||[]),record].slice(-20)}}
      return {ok:false,check:record};
    } finally { busy=false; }
  };
}
module.exports={SOURCE,TERMS,CheckError,dateISO,parseResult,assetIdentity,matchVehicle,guardText,lookup,createChecker};

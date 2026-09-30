const express=require('express'),router=express.Router();
const dns=require('node:dns').promises,net=require('node:net');
const {assets}=require('../store'),{collection}=require('../tenant-collections');
const profiles=collection('fleetFuelProfiles');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
const text=s=>decode(s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const key=a=>[norm(a.make),norm(a.model),norm(a.year||a.manufactureYear),norm(a.engine)].join('|');
let job=null;
function publicAddress(ip){if(net.isIPv4(ip)){const p=ip.split('.').map(Number);return !(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||(p[0]===100&&p[1]>=64&&p[1]<=127))}return net.isIPv6(ip)&&!(/^(::|fc|fd|fe[89ab]|ff)/i.test(ip))}
async function get(url,redirects=0){
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))throw Error('Unsupported source address');
 const ips=await dns.lookup(u.hostname,{all:true});if(!ips.length||ips.some(x=>!publicAddress(x.address)))throw Error('Source address is not public');
 const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'User-Agent':'Supervisor365-FleetResearch/1.0','Accept':'text/html,application/json'}});
 if(r.status>=300&&r.status<400){if(redirects>=3)throw Error('Too many redirects');return get(new URL(r.headers.get('location'),u).href,redirects+1)}
 if(!r.ok)throw Error('Web source returned '+r.status);
 if(!/text\/html|application\/json|text\/plain/i.test(r.headers.get('content-type')||''))throw Error('Source requires manual document review');
 let out='',bytes=0;for await(const chunk of r.body){bytes+=chunk.length;if(bytes>1500000)throw Error('Source is too large');out+=Buffer.from(chunk).toString('utf8')}return out;
}
async function search(query){
 if(process.env.BRAVE_SEARCH_API_KEY){const r=await fetch('https://api.search.brave.com/res/v1/web/search?q='+encodeURIComponent(query)+'&count=5',{signal:AbortSignal.timeout(12000),headers:{'X-Subscription-Token':process.env.BRAVE_SEARCH_API_KEY,'Accept':'application/json'}});if(!r.ok)throw Error('Web search unavailable ('+r.status+')');const d=await r.json();return (d.web?.results||[]).map(x=>({url:x.url,title:x.title}));}
 const html=await get('https://html.duckduckgo.com/html/?q='+encodeURIComponent(query));
 if(/anomaly-modal|challenge-form|bots use DuckDuckGo/i.test(html))throw Error('Search provider blocked automated research. Configure BRAVE_SEARCH_API_KEY for reliable web searches.');
 const results=[];for(const m of html.matchAll(/<a\b([^>]*class=["'][^"']*result__a[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi)){const href=m[1].match(/href=["']([^"']+)["']/i);if(!href)continue;let url=decode(href[1]);try{const u=new URL(url,'https://duckduckgo.com');url=u.searchParams.get('uddg')||u.href;if(new URL(url).protocol==='https:')results.push({url,title:text(m[2])})}catch{}}
 if(!results.length)throw Error('Web search returned no usable results');return results.slice(0,5);
}
function evidence(a,body,url,title){
 const t=text(body),model=norm(a.model),make=norm(a.make);
 const titleWords=String(title||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
 const modelMatches=titleWords.some((_,i)=>[1,2,3,4,5,6].some(n=>titleWords.slice(i,i+n).join('')===model));
 const makerText=norm(title+' '+t.slice(0,10000));
 if(!model||!make||!modelMatches||!(makerText.includes(make)||(make==='cat'&&makerText.includes('caterpillar'))))return null;
 // Treat extracted numbers as published references requiring variant confirmation, never measured asset consumption.
 const findings=[];const re=/(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(?:L|litres?|liters?)\s*(?:\/\s*100\s*km|per\s*100\s*km|\/\s*(?:hr|hour|h)\b|per\s*hour)/gi;
 for(const m of t.matchAll(re)){const context=t.slice(Math.max(0,m.index-170),m.index+m[0].length+100);if(!/fuel\s*(?:consumption|burn|usage|economy)|consumption|combined cycle/i.test(context))continue;const value=Number(m[1].replace(',','.')),high=m[2]?Number(m[2].replace(',','.')):null;if(value<=0||value>500||(high&&high<value))continue;const unit=/100\s*km/i.test(m[0])?'L/100 km':'L/hour';const numeric=m[1]+(m[2]?'–'+m[2]:'');if(!findings.some(x=>x.value===numeric&&x.unit===unit))findings.push({value:numeric,unit,condition:(context.match(/\d+%\s*load|combined(?:\s+cycle)?|extra[ -]urban|urban|idle|full load|low load|medium load|high load/i)||[])[0]||'Conditions not extracted'});if(findings.length>=3)break;}
 // Only explicit fuel type/specification statements, not an arbitrary mention of diesel elsewhere on a page.
 const fuels=new Set();for(const m of t.matchAll(/(?:fuel\s*(?:type|system)|engine\s*type)\s*[:–-]?\s*(diesel|petrol|gasoline|LPG|electric|hybrid)/gi))fuels.add(m[1].toLowerCase()==='gasoline'?'Petrol':m[1][0].toUpperCase()+m[1].slice(1).toLowerCase());
 if(!findings.length&&!fuels.size)return {url,title,fuelType:'',consumption:[]};return {url,title,fuelType:fuels.size===1?[...fuels][0]:'',consumption:findings};
}
async function research(a){
 if(!a.make||!a.model)return {status:'Missing make/model',sources:[],fuelType:'',consumption:[]};
 const query=[a.make,a.model,a.year||a.manufactureYear,a.engine,'fuel type fuel consumption specifications'].filter(Boolean).join(' ');
 const results=await search(query),sources=[];for(const result of results.slice(0,3)){try{const e=evidence(a,await get(result.url),result.url,result.title);if(e)sources.push(e);else sources.push({...result,fuelType:'',consumption:[]})}catch{sources.push({...result,fuelType:'',consumption:[]})}}
 const types=[...new Set(sources.map(s=>s.fuelType).filter(Boolean))],consumption=sources.flatMap(s=>s.consumption.map(c=>({...c,sourceUrl:s.url})));
 return {status:consumption.length?'Published reference — review variant':sources.some(s=>s.fuelType)?'Fuel type found; consumption needs review':'Needs source review',fuelType:types.length===1?types[0]:'',consumption,sources,query,note:'Published references only. Confirm model year, engine/variant and duty cycle before budgeting. Figures are not actual measured fleet consumption.'};
}
function rows(){return assets.map(a=>{const p=profiles.find(x=>x.key===key(a));return {id:a.id,plantId:a.plantId||'',rego:a.rego||'',make:a.make||'',model:a.model||'',profile:p||null}})}
function state(){const r=rows();return {job:job&&{id:job.id,status:job.status,total:job.total,done:job.done,current:job.current,error:job.error},rows:r}}
router.get('/api/fuel/fleet-profile',(req,res)=>res.json(state()));
router.post('/api/fuel/fleet-profile/analyse',(req,res)=>{
 if(!['Owner','Company Admin'].includes(req.get('x-sv365-user-role')))return res.status(403).json({error:'Company administrator access required'});
 if(job?.status==='running')return res.status(202).json(state());
 const unique=[...new Map(assets.map(a=>[key(a),{make:a.make,model:a.model,year:a.year,manufactureYear:a.manufactureYear,engine:a.engine}])).entries()];
 job={id:Date.now().toString(36),status:'running',total:unique.length,done:0,current:'',error:''};res.status(202).json(state());
 void(async()=>{try{for(const [k,a]of unique){job.current=[a.make,a.model].filter(Boolean).join(' ')||'Missing make/model';const cached=profiles.find(p=>p.key===k);if(cached&&cached.status!=='Research unavailable'&&Date.now()-Date.parse(cached.checkedAt)<30*86400000){job.done++;continue}let p;try{p=await research(a)}catch(e){p={status:'Research unavailable',error:e.message,sources:[],fuelType:'',consumption:[]};job.error=e.message}const row={...p,key:k,checkedAt:new Date().toISOString()};if(cached)Object.assign(cached,row);else profiles.push(row);job.done++;if(job.error)break}job.status=job.error?'blocked':'complete';job.current=''}catch(e){job.status='failed';job.error='Unable to save fleet research. Please retry.';job.current='';console.error('Fleet fuel profiling failed',e.message)}})();
});
const section=`<section class="fuelCard"><h2>My Fleet Fuel</h2><p>Research fuel specifications by make and model. Road vehicles use L/100 km; machinery uses L/hour where published. Results are reference figures, subject to year, engine and operating load.</p><button id="fleetFuelAnalyse" type="button">My Fleet Fuel</button><p id="fleetFuelStatus" class="fuelStatus" role="status" aria-live="polite"></p><div class="fuelScroll"><table><thead><tr><th>Plant ID / Rego</th><th>Make</th><th>Model</th><th>Fuel type</th><th>Published consumption</th><th>Research / Sources</th></tr></thead><tbody id="fleetFuelRows"><tr><td colspan="6">Loading fleet...</td></tr></tbody></table></div><p><small>Matching models share research cached for 30 days. Missing or conflicting specifications require review; no consumption is guessed. Fuel tag and refuelling records remain separate.</small></p></section><script src="/fleet-fuel-ui.js"></script>`;
const ui=String.raw`(()=>{const btn=document.getElementById('fleetFuelAnalyse'),status=document.getElementById('fleetFuelStatus'),tbody=document.getElementById('fleetFuelRows');if(!btn)return;let timer;const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const link=(url,label)=>{try{if(new URL(url).protocol!=='https:')return '';return '<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(label)+'</a>'}catch{return ''}};function render(d){tbody.innerHTML=d.rows.map(a=>{const p=a.profile;const values=p?.consumption?.map(c=>esc(c.value+' '+c.unit)+'<br><small>'+esc(c.condition||'Confirm operating conditions')+'</small> '+link(c.sourceUrl,'Source')).join('<br>')||'Not verified';const sources=p?.sources?.map((s,i)=>link(s.url,'Source '+(i+1))).join(' · ')||'';return '<tr><td>'+esc(a.plantId||a.rego||'Not recorded')+(a.plantId&&a.rego?'<br><small>'+esc(a.rego)+'</small>':'')+'</td><td>'+esc(a.make||'Not recorded')+'</td><td>'+esc(a.model||'Not recorded')+'</td><td>'+esc(p?.fuelType||'Not verified')+'</td><td>'+values+'</td><td>'+esc(p?.status||'Not researched')+(p?.checkedAt?'<br><small>'+esc(new Date(p.checkedAt).toLocaleString('en-AU'))+'</small>':'')+(p?.error?'<br><small>'+esc(p.error)+'</small>':'')+(sources?'<br>'+sources:'')+'</td></tr>'}).join('')||'<tr><td colspan="6">No assets in this company.</td></tr>';const j=d.job;btn.disabled=j?.status==='running';status.textContent=j?.status==='running'?'Researching '+j.done+' of '+j.total+' distinct models — '+j.current:j?.error?j.error:j?.status==='complete'?'Analysis complete. Review published references and any assets needing more detail.':'Press My Fleet Fuel to research your fleet.';clearTimeout(timer);if(j?.status==='running')timer=setTimeout(load,2500)}async function load(){try{const r=await fetch('/api/fuel/fleet-profile',{cache:'no-store'});if(!r.ok)throw Error('Unable to load fleet research');render(await r.json())}catch(e){status.textContent=e.message;btn.disabled=false}}btn.onclick=async()=>{btn.disabled=true;status.textContent='Starting fleet research...';try{const r=await fetch('/api/fuel/fleet-profile/analyse',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to start research');render(d)}catch(e){status.textContent=e.message;btn.disabled=false}};load()})();`;
router.get('/fleet-fuel-ui.js',(req,res)=>res.type('application/javascript').send(ui));
module.exports={router,section,evidence,key,publicAddress};

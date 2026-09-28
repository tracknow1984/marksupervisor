// Presentation only: never rewrite stored IDs, API payloads, form values or URLs.
const pattern=()=>/\bAST-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
function assetLabels(){
 const labels=Object.create(null);
 for(const a of require('./store').assets){
  const clean=v=>String(v||'').replace(pattern(),'').trim();
  labels[String(a.id).toLowerCase()]=[a.plantId,a.rego,a.name,[a.make,a.model].filter(Boolean).join(' '),a.type].map(clean).find(Boolean)||'Asset';
 }
 return labels;
}
function displayText(value,labels=assetLabels()){
 return String(value).replace(pattern(),id=>labels[id.toLowerCase()]||'Asset');
}
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function displayHtml(html,labels=assetLabels()){
 // Preserve executable and editable content; only replace text and descriptive attributes.
 return html.replace(/<!--[\s\S]*?-->|<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|<(?:[^"'<>]|"[^"]*"|'[^']*')*>|[^<]+/gi,token=>{
  if(/^<(?:!--|script\b|style\b|textarea\b)/i.test(token))return token;
  if(token.startsWith('<'))return token.replace(/(\s(?:title|alt|aria-label)\s*=\s*)(["'])([\s\S]*?)\2/gi,(all,prefix,quote,text)=>prefix+quote+text.replace(pattern(),id=>escapeHtml(labels[id.toLowerCase()]||'Asset'))+quote);
  return token.replace(pattern(),id=>escapeHtml(labels[id.toLowerCase()]||'Asset'));
 });
}
module.exports={assetLabels,displayText,displayHtml};

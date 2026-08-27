const crypto=require('crypto');
const ALPH='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf){let bits='',out='';for(const b of buf)bits+=b.toString(2).padStart(8,'0');for(let i=0;i<bits.length;i+=5){const chunk=bits.slice(i,i+5).padEnd(5,'0');out+=ALPH[parseInt(chunk,2)]}return out}
function base32Decode(value){const clean=String(value||'').toUpperCase().replace(/[^A-Z2-7]/g,'');let bits='';for(const c of clean){const n=ALPH.indexOf(c);if(n>=0)bits+=n.toString(2).padStart(5,'0')}const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(bytes)}
function generateSecret(){return base32Encode(crypto.randomBytes(20))}
function codeFor(secret,time=Date.now()){const counter=Math.floor(Number(time)/30000),buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(counter));const h=crypto.createHmac('sha1',base32Decode(secret)).update(buf).digest(),offset=h[h.length-1]&15;const n=((h[offset]&0x7f)<<24)|((h[offset+1]&0xff)<<16)|((h[offset+2]&0xff)<<8)|(h[offset+3]&0xff);return String(n%1000000).padStart(6,'0')}
function verify(secret,code,window=1){const target=String(code||'').trim();if(!/^\d{6}$/.test(target)||!secret)return false;for(let i=-window;i<=window;i++)if(codeFor(secret,Date.now()+i*30000)===target)return true;return false}
function otpauth(secret,account,issuer='Supervisor365'){return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`}
module.exports={generateSecret,verify,otpauth,codeFor};

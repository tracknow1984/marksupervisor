const crypto=require('crypto');
function sign(companyId,assetId,secret=process.env.SV365_PUBLIC_QR_SECRET){
 if(!secret)throw new Error('Public QR signing is not configured');
 const payload=Buffer.from(JSON.stringify({c:companyId,a:assetId})).toString('base64url');
 return payload+'.'+crypto.createHmac('sha256',secret).update(payload).digest('base64url');
}
function verify(token,secret=process.env.SV365_PUBLIC_QR_SECRET){
 if(!secret||typeof token!=='string'||token.length>1000||!/^[-\w]+\.[-\w]+$/.test(token))return null;
 const [payload,signature]=token.split('.'),expected=crypto.createHmac('sha256',secret).update(payload).digest();
 const supplied=Buffer.from(signature,'base64url');
 if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return null;
 try{const d=JSON.parse(Buffer.from(payload,'base64url').toString());return typeof d.c==='string'&&d.c.length>0&&d.c.length<=200&&typeof d.a==='string'&&d.a.length>0&&d.a.length<=200?d:null}catch{return null}
}
module.exports={sign,verify};

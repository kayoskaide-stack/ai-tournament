import crypto from "node:crypto";

const TTL_MS = 15 * 60 * 1000;

function secret(){
  const s=String(process.env.BRAINTRUST_SESSION_SECRET||process.env.ARENA_ADMIN_KEY||"");
  if(s.length<16) throw Error("BRAINTRUST_SESSION_SECRET or ARENA_ADMIN_KEY is required.");
  return crypto.createHash("sha256").update("bt-magic:"+s).digest();
}
function b64(v){return Buffer.from(v).toString("base64url")}
function ub64(v){return Buffer.from(v,"base64url").toString("utf8")}
function sign(body){return crypto.createHmac("sha256",secret()).update(body).digest("base64url")}

export function createMagicToken(payload){
  const body=b64(JSON.stringify({...payload,exp:Date.now()+TTL_MS}));
  return `${body}.${sign(body)}`;
}
export function readMagicToken(token){
  const [body,sig]=String(token||"").split(".");
  if(!body||!sig) return null;
  const expected=sign(body);
  const A=Buffer.from(sig),B=Buffer.from(expected);
  if(A.length!==B.length||!crypto.timingSafeEqual(A,B)) return null;
  const data=JSON.parse(ub64(body));
  if(Number(data.exp||0)<Date.now()) return null;
  return data;
}

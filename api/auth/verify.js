import crypto from "node:crypto";
import { readMagicToken } from "../lib/magic-link.js";

function sessionSecret(){
  const s=String(process.env.BRAINTRUST_SESSION_SECRET||process.env.ARENA_ADMIN_KEY||"");
  return crypto.createHash("sha256").update("bt-session:"+s).digest();
}
function sign(v){return crypto.createHmac("sha256",sessionSecret()).update(v).digest("base64url")}
export default function handler(req,res){
  const data=readMagicToken(req.query?.token);
  if(!data) return res.status(400).send("Invalid or expired Brain Trust sign-in link.");
  const payload=Buffer.from(JSON.stringify({
    email:data.email,
    nick:data.nick||data.email.split("@")[0],
    cservice:data.cservice||"",
    iat:Date.now()
  })).toString("base64url");
  const cookie=`${payload}.${sign(payload)}`;
  res.setHeader("Set-Cookie",`bt_session=${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  res.statusCode=302;
  res.setHeader("Location","/");
  res.end();
}

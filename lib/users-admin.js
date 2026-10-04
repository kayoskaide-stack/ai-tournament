import crypto from "node:crypto";
import { requireAccess, audit } from "./braintrust-auth.js";

const OWNER="kayoskaide-stack", REPO="ai-tournament", API="https://api.github.com", FILE="security/users.js";
const RESERVED=new Set(["kyle","killercut","princessgpt","gemmy","claude","grok","deepseek","mistral","openrouter"]);
const headers=token=>({Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"});

async function gh(path,options={}) {
  const token=String(process.env.ARENA_GITHUB_TOKEN||"");
  if(!token)throw Error("ARENA_GITHUB_TOKEN is not configured.");
  const r=await fetch(`${API}/repos/${OWNER}/${REPO}${path}`,{...options,headers:{...headers(token),...(options.headers||{})}});
  const raw=await r.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={message:raw}}
  if(!r.ok)throw Error(`GitHub ${r.status}: ${data.message||raw.slice(0,180)}`);return data;
}
function parseRegistry(source){return JSON.parse(String(source||"").replace(/^\s*export\s+default\s+/,"").replace(/;\s*$/,""))}
function serialize(registry){return `export default ${JSON.stringify(registry,null,2)};\n`}
async function load(){const d=await gh(`/contents/${FILE}?ref=main`);return{sha:d.sha,registry:parseRegistry(Buffer.from(d.content||"","base64").toString("utf8"))}}
async function save(sha,registry,message){return gh(`/contents/${FILE}`,{method:"PUT",body:JSON.stringify({message,content:Buffer.from(serialize(registry)).toString("base64"),sha,branch:"main"})})}
function publicRows(registry){return(registry.users||[]).map(u=>({id:u.id,nick:u.nick,role:u.role,active:u.active!==false,rev:Number(u.rev||1),capabilities:Array.isArray(u.capabilities)?u.capabilities:[]}))}
function randomCode(){return`BT-${crypto.randomBytes(18).toString("base64url")}`}
function hash(code){return crypto.createHash("sha256").update(String(code),"utf8").digest("hex")}

export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  const user=requireAccess(req,res,"manage_users");if(!user)return;
  try{
    const {sha,registry}=await load();registry.users=Array.isArray(registry.users)?registry.users:[];
    if(req.method==="GET")return res.status(200).json({users:publicRows(registry)});
    if(req.method!=="POST")return res.status(405).json({error:"GET or POST only"});
    if(String(process.env.VERCEL_ENV||"")!=="production")return res.status(409).json({error:"User management is disabled on preview deployments."});

    const action=String(req.body?.action||"").toLowerCase(),nick=String(req.body?.nick||"").trim(),role=String(req.body?.role||"member").toLowerCase();
    if(!["create","revoke","role","rotate","activate"].includes(action))return res.status(400).json({error:"Unknown user-management action."});
    if(!nick)return res.status(400).json({error:"Nickname is required."});
    const low=nick.toLowerCase(),existing=registry.users.find(u=>String(u.nick||"").toLowerCase()===low);

    if(action==="create"){
      if(existing)return res.status(409).json({error:"That nickname already exists."});
      if(RESERVED.has(low))return res.status(400).json({error:"That nickname is reserved."});
      if(!["member","maintainer"].includes(role))return res.status(400).json({error:"Role must be member or maintainer."});
      if(!/^[A-Za-z0-9_\-\[\]{}^`|]{2,24}$/.test(nick))return res.status(400).json({error:"Nickname must be 2–24 IRC-safe characters."});
      const code=randomCode();
      registry.users.push({id:`user-${crypto.randomUUID()}`,nick,role,active:true,rev:1,codeSha256:hash(code),capabilities:[]});
      registry.version=Number(registry.version||1)+1;
      await save(sha,registry,`Security: invite ${nick} as ${role}`);
      audit("user_created",user,{target:nick,role});
      return res.status(200).json({ok:true,nick,role,code,note:"This access code is shown once. Save it privately. It becomes active after Vercel redeploys main."});
    }

    if(!existing)return res.status(404).json({error:"User not found."});
    if(existing.role==="owner")return res.status(400).json({error:"The owner account cannot be modified from this endpoint."});
    if(action==="revoke"){existing.active=false;existing.rev=Number(existing.rev||1)+1}
    else if(action==="activate"){existing.active=true;existing.rev=Number(existing.rev||1)+1}
    else if(action==="role"){if(!["member","maintainer"].includes(role))return res.status(400).json({error:"Role must be member or maintainer."});existing.role=role;existing.rev=Number(existing.rev||1)+1}
    else if(action==="rotate"){
      const code=randomCode();existing.codeSha256=hash(code);existing.rev=Number(existing.rev||1)+1;existing.active=true;
      registry.version=Number(registry.version||1)+1;await save(sha,registry,`Security: rotate access for ${nick}`);audit("user_rotated",user,{target:nick});
      return res.status(200).json({ok:true,nick,code,note:"Old sessions and the old access code are revoked after Vercel redeploys."});
    }
    registry.version=Number(registry.version||1)+1;await save(sha,registry,`Security: ${action} ${nick}`);audit(`user_${action}`,user,{target:nick,role:existing.role});
    return res.status(200).json({ok:true,users:publicRows(registry)});
  }catch(e){return res.status(500).json({error:e?.message||String(e)})}
}

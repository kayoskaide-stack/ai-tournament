import { requireAccess, audit } from "./braintrust-auth.js";
const OWNER="kayoskaide-stack",REPO="ai-tournament",API="https://api.github.com",FILE="security/policy.js";
const headers=token=>({Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"});
async function gh(path,options={}){const token=String(process.env.ARENA_GITHUB_TOKEN||"");if(!token)throw Error("ARENA_GITHUB_TOKEN is not configured.");const r=await fetch(`${API}/repos/${OWNER}/${REPO}${path}`,{...options,headers:{...headers(token),...(options.headers||{})}}),raw=await r.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={message:raw}}if(!r.ok)throw Error(`GitHub ${r.status}: ${data.message||raw.slice(0,180)}`);return data}
const parse=source=>JSON.parse(String(source||"").replace(/^\s*export\s+default\s+/,"").replace(/;\s*$/,""));
const serialize=p=>`export default ${JSON.stringify(p,null,2)};\n`;

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const user=requireAccess(req,res,"manage_security");if(!user)return;
  try{
    const d=await gh(`/contents/${FILE}?ref=main`),policy=parse(Buffer.from(d.content||"","base64").toString("utf8"));
    if(req.method==="GET")return res.status(200).json({policy});
    if(req.method!=="POST")return res.status(405).json({error:"GET or POST only"});
    if(String(process.env.VERCEL_ENV||"")!=="production")return res.status(409).json({error:"Security policy changes are disabled on preview deployments."});
    const action=String(req.body?.action||"").toLowerCase();
    if(!["freeze","unfreeze"].includes(action))return res.status(400).json({error:"Action must be freeze or unfreeze."});
    policy.frozen=action==="freeze";policy.reason=policy.frozen?String(req.body?.reason||"Owner emergency lockdown").slice(0,240):"";
    policy.changedAt=new Date().toISOString();policy.changedBy=user.nick;policy.version=Number(policy.version||1)+1;
    await gh(`/contents/${FILE}`,{method:"PUT",body:JSON.stringify({message:`Security: ${action} Brain Trust`,content:Buffer.from(serialize(policy)).toString("base64"),sha:d.sha,branch:"main"})});
    audit(`security_${action}`,user,{reason:policy.reason});
    return res.status(200).json({ok:true,policy,note:"The policy becomes active after Vercel redeploys main."});
  }catch(e){return res.status(500).json({error:e?.message||String(e)})}
}

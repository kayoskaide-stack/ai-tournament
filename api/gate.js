
import { requireAccess, audit } from "../lib/braintrust-auth.js";
import { BRAINTRUST_TOOLS } from "../lib/braintrust-tools.js";

import contestant from "./contestant.js";
import freeLife from "./free-life.js";
import speak from "./speak.js";
import transcribe from "./transcribe.js";
import status from "./status.js";
import funds from "./funds.js";
import autopilot from "./autopilot.js";
import imageGeneration from "../lib/braintrust-image.js";

const handlers = { contestant, "free-life": freeLife, speak, transcribe, status, funds, image: imageGeneration };
const architectureCaps = { propose:"propose", status:"preview", approve:"approve", reject:"reject", rollback:"rollback" };

function relayEndpoint(kind) {
  const direct = {
    status: process.env.BRAINTRUST_RELAY_STATUS_URL,
    pm: process.env.BRAINTRUST_RELAY_PM_URL,
    tool: process.env.BRAINTRUST_RELAY_TOOL_URL,
    dcc: process.env.BRAINTRUST_RELAY_DCC_URL
  }[kind];
  if (String(direct || "").trim()) return String(direct).trim();
  const base = String(process.env.BRAINTRUST_RELAY_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  return `${base}${{status:"/health",pm:"/pm",tool:"/tool",dcc:"/dcc"}[kind]}`;
}
async function relayFetch(kind,{method="GET",body}={}) {
  const endpoint=relayEndpoint(kind),token=String(process.env.BRAINTRUST_RELAY_TOKEN||"").trim();
  if(!endpoint||!token){const e=new Error("Trusted IRC relay bridge is not configured.");e.status=503;throw e}
  const r=await fetch(endpoint,{
    method,
    headers:{Accept:"application/json",Authorization:`Bearer ${token}`,...(body?{"Content-Type":"application/json"}:{})},
    body:body?JSON.stringify(body):undefined
  });
  const raw=await r.text();let data;try{data=raw?JSON.parse(raw):{}}catch{data={raw:raw.slice(0,1500)}}
  if(!r.ok){const e=new Error(data?.error||`Relay HTTP ${r.status}`);e.status=502;throw e}
  return data;
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const target=String(req.query?.target||"").toLowerCase();

  if(target==="autopilot"){
    const action=String(req.body?.action||"").toLowerCase();
    if(String(process.env.VERCEL_ENV||"")!=="production"&&["approve","reject","rollback"].includes(action))
      return res.status(409).json({error:"Production actions are disabled on preview deployments."});
    const capability=architectureCaps[action]||"propose";
    const user=requireAccess(req,res,capability);if(!user)return;
    const admin=String(process.env.ARENA_ADMIN_KEY||"");
    if(admin.length<16)return res.status(503).json({error:"Architecture control key is not configured."});
    req.braintrustUser=user;req.braintrustAuthorized=true;req.headers.authorization=`Bearer ${admin}`;
    audit(`architecture_${action}`,user,{pr:req.body?.pr||null,backup:req.body?.backup||null,task:action==="propose"?String(req.body?.task||"").slice(0,400):undefined});
    return autopilot(req,res);
  }

  if(target==="capabilities"){
    const user=requireAccess(req,res,"chat");if(!user)return;
    if(req.method!=="GET")return res.status(405).json({error:"GET only"});
    return res.status(200).json({ok:true,tools:BRAINTRUST_TOOLS,features:{passwordless:true,cserviceUsernameOnly:true,ircPrivateMessages:true,ircStatus:true,buildConsole:true,uploads:true,camera:true,dcc:true,imageGeneration:true}});
  }

  if(target==="irc-status"){
    const user=requireAccess(req,res,"chat");if(!user)return;
    if(req.method!=="GET")return res.status(405).json({error:"GET only"});
    try{return res.status(200).json(await relayFetch("status"))}catch(e){return res.status(e.status||502).json({error:e.message})}
  }

  if(target==="irc-pm"){
    const user=requireAccess(req,res,"chat");if(!user)return;
    if(req.method!=="POST")return res.status(405).json({error:"POST only"});
    const nick=String(req.body?.nick||"").trim(),text=String(req.body?.text||"").trim();
    if(!/^[A-Za-z0-9_\-\[\]\\`^{}|]{1,64}$/.test(nick)||!text)return res.status(400).json({error:"Valid nick and message text required."});
    try{const result=await relayFetch("pm",{method:"POST",body:{nick,text:text.slice(0,1600)}});audit("irc_private_message",user,{nick});return res.status(200).json(result)}
    catch(e){return res.status(e.status||502).json({error:e.message})}
  }

  if(target==="relay-tool"){
    const user=requireAccess(req,res,"chat");if(!user)return;
    if(req.method!=="POST")return res.status(405).json({error:"POST only"});
    const name=String(req.body?.name||"").toLowerCase();
    const args=Array.isArray(req.body?.args)?req.body.args.map(x=>String(x).slice(0,500)).slice(0,12):[];
    if(!["catfish","hunt","ascii"].includes(name))return res.status(400).json({error:"Unknown relay tool."});
    try{const result=await relayFetch("tool",{method:"POST",body:{name,args}});audit("relay_tool",user,{name});return res.status(200).json(result)}
    catch(e){return res.status(e.status||502).json({error:e.message})}
  }

  if(target==="relay-dcc"){
    const user=requireAccess(req,res,"manage_security");if(!user)return;
    if(req.method!=="POST")return res.status(405).json({error:"POST only"});
    const nick=String(req.body?.nick||"").trim(),filePath=String(req.body?.filePath||"").trim();
    if(!nick||!filePath)return res.status(400).json({error:"nick and filePath required"});
    try{const result=await relayFetch("dcc",{method:"POST",body:{nick,filePath}});audit("irc_dcc_send",user,{nick,file:filePath.split("/").pop()});return res.status(200).json(result)}
    catch(e){return res.status(e.status||502).json({error:e.message})}
  }

  const protectedHandler=handlers[target];
  if(!protectedHandler)return res.status(404).json({error:"Unknown protected API route."});
  const capability=target==="funds"?"view_funds":"chat";
  const user=requireAccess(req,res,capability);if(!user)return;
  req.braintrustUser=user;req.braintrustAuthorized=true;
  return protectedHandler(req,res);
}

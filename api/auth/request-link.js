import { createMagicToken } from "../lib/magic-link.js";

function origin(req){
  const proto=String(req.headers["x-forwarded-proto"]||"https").split(",")[0];
  const host=String(req.headers["x-forwarded-host"]||req.headers.host||"");
  return `${proto}://${host}`;
}
async function sendEmail(to,link){
  const key=String(process.env.RESEND_API_KEY||"");
  const from=String(process.env.BRAINTRUST_EMAIL_FROM||"");
  if(!key||!from) throw Error("RESEND_API_KEY / BRAINTRUST_EMAIL_FROM not configured.");
  const r=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      from,to,
      subject:"Your Brain Trust sign-in link",
      html:`<p>Open this private sign-in link:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`
    })
  });
  if(!r.ok) throw Error(`Resend ${r.status}: ${(await r.text()).slice(0,200)}`);
}
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});
  const email=String(req.body?.email||"").trim().toLowerCase();
  const nick=String(req.body?.nick||"").trim();
  const cservice=String(req.body?.cserviceUsername||"").trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({error:"Valid email required."});
  if(cservice && !/^[A-Za-z0-9_\-\[\]\\`^{}|]{1,32}$/.test(cservice))
    return res.status(400).json({error:"Invalid CService username format."});
  const token=createMagicToken({email,nick,cservice});
  const link=`${origin(req)}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendEmail(email,link);
  return res.status(200).json({ok:true,message:"Magic link sent."});
}

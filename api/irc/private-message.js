export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});
  const nick=String(req.body?.nick||"").trim();
  const text=String(req.body?.text||"").trim();
  if(!nick||!text) return res.status(400).json({error:"nick and text required"});
  const endpoint=String(process.env.BRAINTRUST_RELAY_PM_URL||"").trim();
  const token=String(process.env.BRAINTRUST_RELAY_TOKEN||"").trim();
  if(!endpoint||!token) return res.status(503).json({error:"Private relay bridge is not configured."});
  const r=await fetch(endpoint,{
    method:"POST",
    headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
    body:JSON.stringify({nick,text})
  });
  const raw=await r.text();
  return res.status(r.ok?200:502).send(raw);
}

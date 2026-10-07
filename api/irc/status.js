export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const endpoint=String(process.env.BRAINTRUST_RELAY_STATUS_URL||"").trim();
  if(!endpoint) return res.status(200).json({ok:true,configured:false,status:"relay status endpoint not configured"});
  try{
    const r=await fetch(endpoint,{headers:{Accept:"application/json"}});
    const text=await r.text();
    let data; try{data=JSON.parse(text)}catch{data={raw:text.slice(0,1000)}}
    return res.status(r.ok?200:502).json({ok:r.ok,configured:true,relay:data});
  }catch(e){
    return res.status(502).json({ok:false,error:e.message});
  }
}

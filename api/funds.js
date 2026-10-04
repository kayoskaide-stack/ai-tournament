const META=[
 {key:"openai",nick:"PrincessGPT",provider:"OpenAI",env:"OPENAI_API_KEY",checkout:"https://platform.openai.com/settings/organization/billing/overview"},
 {key:"gemini",nick:"Gemmy",provider:"Google Gemini",env:"GEMINI_API_KEY",checkout:"https://aistudio.google.com/"},
 {key:"anthropic",nick:"Claude",provider:"Anthropic",env:"ANTHROPIC_API_KEY",checkout:"https://console.anthropic.com/settings/billing"},
 {key:"xai",nick:"Grok",provider:"xAI",env:"XAI_API_KEY",checkout:"https://console.x.ai/"},
 {key:"deepseek",nick:"DeepSeek",provider:"DeepSeek",env:"DEEPSEEK_API_KEY",checkout:"https://platform.deepseek.com/top_up"},
 {key:"mistral",nick:"Mistral",provider:"Mistral",env:"MISTRAL_API_KEY",checkout:"https://console.mistral.ai/"},
 {key:"openrouter",nick:"OpenRouter",provider:"OpenRouter",env:"OPENROUTER_API_KEY",checkout:"https://openrouter.ai/credits"}
];

async function getJson(url,key){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),5000);
 try{
  const r=await fetch(url,{headers:{Authorization:`Bearer ${key}`,Accept:"application/json"},signal:controller.signal});
  const raw=await r.text();
  let data={};
  try{data=raw?JSON.parse(raw):{}}catch{}
  if(!r.ok)throw Error(data?.error?.message||data?.message||`HTTP ${r.status}`);
  return data;
 }finally{clearTimeout(timer)}
}

async function deepseek(key){
 const d=await getJson("https://api.deepseek.com/user/balance",key);
 const info=(d.balance_infos||[]).find(x=>x.currency==="USD")||(d.balance_infos||[])[0];
 return {
  available:info?Number(info.total_balance):null,
  currency:info?.currency||"USD",
  live:true,
  isAvailable:d.is_available!==false,
  used:null
 };
}

async function openrouter(key){
 const d=await getJson("https://openrouter.ai/api/v1/credits",key);
 const x=d?.data||d||{};
 const total=Number(x.total_credits??x.credits??x.balance);
 const used=Number(x.total_usage??x.usage);
 const explicit=Number(x.available_credits??x.remaining_credits);
 let available=null;
 if(Number.isFinite(explicit))available=explicit;
 else if(Number.isFinite(total)&&Number.isFinite(used))available=total-used;
 else if(Number.isFinite(total))available=total;
 return {
  available:Number.isFinite(available)?available:null,
  currency:"USD",
  live:true,
  isAvailable:available==null?true:available>0,
  used:Number.isFinite(used)?used:null
 };
}

export default async function handler(req,res){
 if(req.method!=="GET"){
  res.setHeader("Allow","GET");
  return res.status(405).json({error:"GET only"});
 }
 res.setHeader("Cache-Control","no-store, max-age=0");

 const providers=await Promise.all(META.map(async m=>{
  const configured=!!process.env[m.env];
  const item={
   key:m.key,nick:m.nick,provider:m.provider,configured,checkout:m.checkout,
   available:null,currency:"USD",used:null,live:false,error:""
  };
  if(!configured)return item;
  try{
   let live=null;
   if(m.key==="deepseek")live=await deepseek(process.env[m.env]);
   if(m.key==="openrouter")live=await openrouter(process.env[m.env]);
   if(live)Object.assign(item,live);
  }catch(e){
   item.error=e?.message||String(e);
  }
  return item;
 }));

 return res.status(200).json({providers});
}

function safeHttps(value){
  try{const u=new URL(String(value||''));return u.protocol==='https:'?u.toString():''}catch{return''}
}
async function probe(url,headers={}){
  if(!url)return{configured:false,online:false};
  try{
    const r=await fetch(url,{headers,signal:AbortSignal.timeout(3500),cache:'no-store'});
    return{configured:true,online:r.ok,status:r.status};
  }catch(e){return{configured:true,online:false,error:e?.name==='AbortError'||e?.name==='TimeoutError'?'timeout':'unreachable'}}
}
async function localGrokStatus(){
  const url=String(process.env.GROK_WORKER_URL||'').replace(/\/+$/,'');
  const configured=Boolean(url&&process.env.ARENA_RELAY_KEY);
  const result={configured,online:false,model:'grok-build',route:'latitude/grok-build'};
  if(!configured)return result;
  const p=await probe(url+'/health');return{...result,...p,configured:true};
}
async function relayStatus(){
  const base=String(process.env.BRAINTRUST_RELAY_BASE_URL||'').replace(/\/+$/,'');
  const token=String(process.env.BRAINTRUST_RELAY_TOKEN||'');
  if(!base.startsWith('https://')||token.length<16)return{configured:false,online:false};
  return probe(base+'/health',{Authorization:`Bearer ${token}`,Accept:'application/json'});
}

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  const definitions=[
    ['openai','OpenAI','OPENAI_API_KEY'],['gemini','Gemini','GEMINI_API_KEY'],['anthropic','Anthropic','ANTHROPIC_API_KEY'],
    ['xai','xAI','XAI_API_KEY'],['deepseek','DeepSeek','DEEPSEEK_API_KEY'],['mistral','Mistral','MISTRAL_API_KEY'],['openrouter','OpenRouter','OPENROUTER_API_KEY']
  ];
  const providers=definitions.map(([key,label,env])=>({key,label,configured:Boolean(process.env[env])}));
  const grokWorker=await localGrokStatus();
  const relay=await relayStatus();
  const xaiApiConfigured=Boolean(process.env.XAI_API_KEY);
  const configuredKeys=providers.filter(x=>x.configured).map(x=>x.key);
  if(grokWorker.online&&!configuredKeys.includes('xai'))configuredKeys.push('xai');
  const configured=definitions.filter(([key])=>configuredKeys.includes(key)).map(([,label])=>label);
  const donateUrl=safeHttps(process.env.BRAINTRUST_DONATE_URL);
  const intelligenceFundUrl=safeHttps(process.env.BRAINTRUST_INTELLIGENCE_FUND_URL);
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({
    configured,configuredKeys,providers,grokWorker,xaiApiConfigured,
    services:{
      relayConfigured:relay.configured===true,relayOnline:relay.online===true,relayStatus:relay.status||0,
      resendConfigured:Boolean(process.env.RESEND_API_KEY&&process.env.BRAINTRUST_EMAIL_FROM),
      githubConfigured:Boolean(process.env.ARENA_GITHUB_TOKEN),
      sessionConfigured:Boolean(process.env.BRAINTRUST_SESSION_SECRET||process.env.ARENA_ADMIN_KEY),
      ownerEmailConfigured:Boolean(process.env.BRAINTRUST_OWNER_EMAIL)
    },
    support:{
      donateUrl,intelligenceFundUrl,
      policy:{
        name:'Marginal Intelligence Budget',
        rule:'Spend pooled funds where the next dollar produces the largest measured improvement in successful, useful, non-duplicative answers.',
        measures:['successful-answer rate','unique useful contribution rate','verification/correction value','latency','truncation and retry rate','cost per useful contribution'],
        guardrails:['zero-price models first when they are adequate','no silent provider substitution','small canary allocations before larger spend','keep a reliability reserve','show provider failures instead of paying blindly']
      }
    },
    deployment:{environment:String(process.env.VERCEL_ENV||'unknown'),commit:String(process.env.VERCEL_GIT_COMMIT_SHA||'').slice(0,12),branch:String(process.env.VERCEL_GIT_COMMIT_REF||'')}
  });
}

async function localGrokStatus(){

 const url=
  String(process.env.GROK_WORKER_URL||"")
  .replace(/\/+$/,"");

 const relayKey=
  String(process.env.ARENA_RELAY_KEY||"");

 const configured=
  Boolean(url && relayKey);

 const result={
  configured,
  online:false,
  model:"grok-build",
  route:"latitude/grok-build"
 };

 if(!configured)
  return result;

 const controller=
  new AbortController();

 const timer=
  setTimeout(
   ()=>controller.abort(),
   3500
  );

 try{

  const r=
   await fetch(
    url+"/health",
    {
     headers:{
      Accept:"application/json"
     },
     signal:controller.signal,
     cache:"no-store"
    }
   );

  const d=
   await r.json()
   .catch(()=>({}));

  result.online=
   Boolean(
    r.ok &&
    d?.ok
   );

  if(!result.online)
   result.error=
    "health check failed";

 }catch(e){

  result.error=
   e?.name==="AbortError"
    ?"timeout"
    :"unreachable";

 }finally{

  clearTimeout(timer);

 }

 return result;
}


export default async function handler(req,res){

 const checks={
  openai:"OPENAI_API_KEY",
  gemini:"GEMINI_API_KEY",
  anthropic:"ANTHROPIC_API_KEY",
  xai:"XAI_API_KEY",
  deepseek:"DEEPSEEK_API_KEY",
  mistral:"MISTRAL_API_KEY",
  openrouter:"OPENROUTER_API_KEY"
 };

 const labels={
  openai:"OpenAI",
  gemini:"Gemini",
  anthropic:"Anthropic",
  xai:"xAI",
  deepseek:"DeepSeek",
  mistral:"Mistral",
  openrouter:"OpenRouter"
 };


 const grokWorker=
  await localGrokStatus();

 const xaiApiConfigured=
  Boolean(
   process.env.XAI_API_KEY
  );


 const configuredKeys=
  Object.entries(checks)

  .filter(
   ([,env])=>
    Boolean(
     process.env[env]
    )
  )

  .map(
   ([key])=>key
  );


 /*
  * Make Grok a real available contestant
  * whenever the Latitude answers its health check.
  */
 if(
  grokWorker.online &&
  !configuredKeys.includes("xai")
 ){
  configuredKeys.push("xai");
 }


 const configured=
  configuredKeys.map(
   key=>labels[key]
  );


 res.setHeader(
  "Cache-Control",
  "no-store"
 );


 res.status(200).json({
  configured,
  configuredKeys,
  grokWorker,
  xaiApiConfigured
 });

}

async function callOpenAI(key, model, prompt, base="https://api.openai.com/v1"){
 const r=await fetch(base+"/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model,messages:[{role:"user",content:prompt}],temperature:.2,max_tokens:20})});
 if(!r.ok) throw new Error(await r.text()); const j=await r.json(); return j.choices?.[0]?.message?.content||"";
}
async function callGemini(key,prompt){
 const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key="+encodeURIComponent(key),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.2,maxOutputTokens:20}})});
 if(!r.ok) throw new Error(await r.text());const j=await r.json();return j.candidates?.[0]?.content?.parts?.[0]?.text||"";
}
async function callClaude(key,prompt){
 const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":key,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-3-5-haiku-latest",max_tokens:20,messages:[{role:"user",content:prompt}]})});
 if(!r.ok) throw new Error(await r.text());const j=await r.json();return j.content?.[0]?.text||"";
}
export default async function handler(req,res){
 if(req.method!=="POST") return res.status(405).json({error:"POST only"});
 const {provider,name,mode,challenge,hint,used=[]}=req.body||{};
 const prompt=`You are ${name}, a contestant in an AI game show called AI Tournament.
Mode: ${mode}
Challenge: ${challenge}
Hint: ${hint||"none"}
Already guessed answers (do not repeat): ${used.join(", ")||"none"}
Return ONLY your single best short guess. No explanation, punctuation, or extra words.`;
 try{
  let text="";
  if(provider==="openai"&&process.env.OPENAI_API_KEY) text=await callOpenAI(process.env.OPENAI_API_KEY,process.env.OPENAI_MODEL||"gpt-4o-mini",prompt);
  else if(provider==="gemini"&&process.env.GEMINI_API_KEY) text=await callGemini(process.env.GEMINI_API_KEY,prompt);
  else if(provider==="anthropic"&&process.env.ANTHROPIC_API_KEY) text=await callClaude(process.env.ANTHROPIC_API_KEY,prompt);
  else if(provider==="xai"&&process.env.XAI_API_KEY) text=await callOpenAI(process.env.XAI_API_KEY,process.env.XAI_MODEL||"grok-3-mini",prompt,"https://api.x.ai/v1");
  else return res.status(503).json({error:"Provider key not configured"});
  const guess=text.trim().split(/\s+/)[0].replace(/^["'`]+|["'`.,!?;:]+$/g,"");
  res.status(200).json({guess});
 }catch(e){res.status(500).json({error:"AI connector failed"});}
}
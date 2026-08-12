export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"POST only"});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"OPENAI_API_KEY is not configured"});
 try{
  const audio=Buffer.from(String(req.body?.audio||""),"base64");if(!audio.length)throw Error("No recording received");if(audio.length>12e6)throw Error("Recording too large");
  const mime=String(req.body?.mime||"audio/mp4").split(';')[0],ext=mime.includes('webm')?'webm':mime.includes('ogg')?'ogg':'m4a';
  const form=new FormData();form.append("model","gpt-4o-mini-transcribe");form.append("file",new Blob([audio],{type:mime}),`kyle.${ext}`);form.append("language","en");
  const r=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form});const data=await r.json();if(!r.ok)throw Error(data?.error?.message||`OpenAI transcription HTTP ${r.status}`);return res.status(200).json({text:data.text||""});
 }catch(e){return res.status(500).json({error:e.message||String(e)})}
}

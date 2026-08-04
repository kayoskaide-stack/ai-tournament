export default function handler(req,res){
 const configured=[];
 if(process.env.OPENAI_API_KEY) configured.push("OpenAI");
 if(process.env.GEMINI_API_KEY) configured.push("Gemini");
 if(process.env.ANTHROPIC_API_KEY) configured.push("Anthropic");
 if(process.env.XAI_API_KEY) configured.push("xAI");
 res.status(200).json({configured});
}
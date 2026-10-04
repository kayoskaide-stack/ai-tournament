export default function handler(req,res){
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
  openai:"OpenAI",gemini:"Gemini",anthropic:"Anthropic",xai:"xAI",
  deepseek:"DeepSeek",mistral:"Mistral",openrouter:"OpenRouter"
 };
 const configuredKeys=Object.entries(checks).filter(([,env])=>!!process.env[env]).map(([key])=>key);
 const configured=configuredKeys.map(key=>labels[key]);
 res.setHeader("Cache-Control","no-store");
 res.status(200).json({configured,configuredKeys});
}

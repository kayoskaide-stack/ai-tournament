import { BRAINTRUST_TOOLS } from "./lib/braintrust-tools.js";

export default function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET") return res.status(405).json({error:"GET only"});
  return res.status(200).json({
    ok:true,
    tools:BRAINTRUST_TOOLS,
    auth:{
      passwordlessEmail:true,
      cserviceUsernameOnly:true,
      neverRequestCservicePassword:true
    },
    irc:{
      privateMessages:true,
      status:true,
      dccSend:true
    }
  });
}

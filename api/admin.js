import usersHandler from "../lib/users-admin.js";
import securityHandler from "../lib/security-admin.js";
import auditAdmin from "../lib/audit-admin.js";
import deployAdmin from "../lib/deploy-admin.js";
import registrationSync from "../lib/registration-sync.js";

export default async function handler(req,res){
  const scope=String(req.query?.scope||"").toLowerCase();
  if(scope==="users")return usersHandler(req,res);
  if(scope==="irc-users")return usersHandler(req,res,{allowRelay:true});
  if(scope==="security")return securityHandler(req,res);
  if(scope==="audit")return auditAdmin(req,res);
  if(scope==="deploy")return deployAdmin(req,res);
  if(scope==="self-sync")return registrationSync(req,res);
  return res.status(400).json({error:"Unknown administration scope."});
}

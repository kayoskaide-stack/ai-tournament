import usersHandler from "../lib/users-admin.js";
import securityHandler from "../lib/security-admin.js";

export default async function handler(req,res){
  const scope=String(req.query?.scope||"").toLowerCase();

  if(scope==="users")
    return usersHandler(req,res);

  if(scope==="security")
    return securityHandler(req,res);

  return res.status(400).json({
    error:"Unknown administration scope."
  });
}

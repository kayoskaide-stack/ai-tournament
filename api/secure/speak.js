import { requireAccess } from "../_auth.js";
import targetHandler from "../speak.js";
export default async function handler(req,res){
  const user=requireAccess(req,res,"chat",{allowRelay:false});
  if(!user)return;
  req.braintrustUser=user;
  return targetHandler(req,res);
}

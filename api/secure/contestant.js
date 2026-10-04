import { requireAccess } from "../_auth.js";
import targetHandler from "../contestant.js";
export default async function handler(req,res){
  const user=requireAccess(req,res,"chat",{allowRelay:true});
  if(!user)return;
  req.braintrustUser=user;
  return targetHandler(req,res);
}

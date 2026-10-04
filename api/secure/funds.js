import { requireAccess } from "../_auth.js";
import targetHandler from "../funds.js";
export default async function handler(req,res){
  const user=requireAccess(req,res,"view_funds",{allowRelay:false});
  if(!user)return;
  req.braintrustUser=user;
  return targetHandler(req,res);
}

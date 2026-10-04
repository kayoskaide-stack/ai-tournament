import { requireAccess, audit } from "../_auth.js";
import targetHandler from "../autopilot.js";
const ACTION_CAP={propose:"propose",status:"preview",approve:"approve",reject:"reject",rollback:"rollback"};
export default async function handler(req,res){
  const action=String(req.body?.action||"");
  if(String(process.env.VERCEL_ENV||"")!=="production"&&["approve","reject","rollback"].includes(action))
    return res.status(409).json({error:"Production merge/reject/rollback actions are disabled on preview deployments."});
  const capability=ACTION_CAP[action]||"propose",user=requireAccess(req,res,capability);if(!user)return;
  const admin=String(process.env.ARENA_ADMIN_KEY||"");if(admin.length<16)return res.status(503).json({error:"Architecture control key is not configured."});
  req.braintrustUser=user;req.headers.authorization=`Bearer ${admin}`;
  audit(`architecture_${action}`,user,{pr:req.body?.pr||null,backup:req.body?.backup||null,task:action==="propose"?String(req.body?.task||"").slice(0,400):undefined});
  return targetHandler(req,res);
}

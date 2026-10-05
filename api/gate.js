import {
  requireAccess,
  audit
} from "../lib/braintrust-auth.js";

import contestant from "./contestant.js";
import freeLife from "./free-life.js";
import speak from "./speak.js";
import transcribe from "./transcribe.js";
import status from "./status.js";
import funds from "./funds.js";
import autopilot from "./autopilot.js";

const handlers={
  contestant,
  "free-life":freeLife,
  speak,
  transcribe,
  status,
  funds
};

const architectureCaps={
  propose:"propose",
  status:"preview",
  approve:"approve",
  reject:"reject",
  rollback:"rollback"
};

export default async function handler(req,res){
  const target=String(req.query?.target||"").toLowerCase();

  if(target==="autopilot"){
    const action=String(req.body?.action||"").toLowerCase();

    if(
      String(process.env.VERCEL_ENV||"")!=="production" &&
      ["approve","reject","rollback"].includes(action)
    ){
      return res.status(409).json({
        error:"Production actions are disabled on preview deployments."
      });
    }

    const capability=architectureCaps[action]||"propose";
    const user=requireAccess(req,res,capability);
    if(!user)return;

    const admin=String(process.env.ARENA_ADMIN_KEY||"");
    if(admin.length<16)
      return res.status(503).json({
        error:"Architecture control key is not configured."
      });

    req.braintrustUser=user; req.braintrustAuthorized=true;
    req.headers.authorization=`Bearer ${admin}`;

    audit(`architecture_${action}`,user,{
      pr:req.body?.pr||null,
      backup:req.body?.backup||null,
      task:action==="propose"
        ? String(req.body?.task||"").slice(0,400)
        : undefined
    });

    return autopilot(req,res);
  }

  const handler=handlers[target];

  if(!handler)
    return res.status(404).json({
      error:"Unknown protected API route."
    });

  const capability=target==="funds"?"view_funds":"chat";
  const user=requireAccess(req,res,capability);
  if(!user)return;

  req.braintrustUser=user; req.braintrustAuthorized=true;
  return handler(req,res);
}

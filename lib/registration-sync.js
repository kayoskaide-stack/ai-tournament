import { requireAccess, audit } from './braintrust-auth.js';

const OWNER='kayoskaide-stack',REPO='ai-tournament',API='https://api.github.com',FILE='security/users.js';
const headers=token=>({Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'});
function parse(source){return JSON.parse(String(source||'').replace(/^\s*export\s+default\s+/,'').replace(/;\s*$/,''))}
function serialize(registry){return `export default ${JSON.stringify(registry,null,2)};\n`}

export default async function registrationSync(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const user=requireAccess(req,res,'chat');if(!user)return;
  if(user.role==='owner')return res.status(200).json({ok:true,synced:true,owner:true});
  if(user.emailVerified!==true||user.cserviceVerified!==true)return res.status(409).json({error:'Registration is not complete.'});
  if(String(process.env.VERCEL_ENV||'')!=='production')return res.status(200).json({ok:true,synced:false,preview:true});
  const token=String(process.env.ARENA_GITHUB_TOKEN||'');if(!token)return res.status(503).json({error:'Registration status storage is unavailable.'});
  try{
    for(let attempt=0;attempt<3;attempt++){
      const current=await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${FILE}?ref=main`,{headers:headers(token)});
      if(!current.ok)throw Error(`GitHub read ${current.status}`);
      const file=await current.json(),registry=parse(Buffer.from(file.content||'','base64').toString('utf8'));
      const row=(registry.users||[]).find(x=>String(x.id||'')===String(user.id));
      if(!row||row.active===false||Number(row.rev||1)!==Number(user.rev||1))return res.status(409).json({error:'Registry membership changed; sign in again.'});
      if(row.verified===true)return res.status(200).json({ok:true,synced:true,already:true});
      row.verified=true;registry.version=Number(registry.version||1)+1;
      const saved=await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${FILE}`,{method:'PUT',headers:headers(token),body:JSON.stringify({message:`Security: reconcile ${String(row.nick||'guest').slice(0,24)} registration verified`,content:Buffer.from(serialize(registry)).toString('base64'),sha:file.sha,branch:'main'})});
      if(saved.ok){audit('registration_status_reconciled',user,{target:row.nick});return res.status(200).json({ok:true,synced:true})}
      if(saved.status!==409||attempt===2)throw Error(`GitHub write ${saved.status}`);
    }
  }catch(e){return res.status(503).json({error:`Registration status sync unavailable: ${e.message||e}`})}
}

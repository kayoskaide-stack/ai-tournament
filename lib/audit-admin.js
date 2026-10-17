import { requireAccess } from './braintrust-auth.js';

const OWNER='kayoskaide-stack',REPO='ai-tournament',API='https://api.github.com';
const headers=token=>({Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'});

export default async function auditAdmin(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  const user=requireAccess(req,res,'manage_users');if(!user)return;
  const token=String(process.env.ARENA_GITHUB_TOKEN||'');if(!token)return res.status(503).json({error:'Audit history is unavailable.'});
  try{
    const r=await fetch(`${API}/repos/${OWNER}/${REPO}/commits?per_page=80`,{headers:headers(token)});
    if(!r.ok)throw Error(`GitHub ${r.status}`);
    const rows=await r.json();
    const relevant=/^(?:Security:|Arena Auto-Pilot|Rollback production|Merge pull request|Unify owner user control|Require guest email confirmation)/i;
    const events=(Array.isArray(rows)?rows:[]).filter(x=>relevant.test(String(x?.commit?.message||''))).slice(0,60).map(x=>({
      sha:String(x.sha||'').slice(0,12),
      when:String(x?.commit?.committer?.date||x?.commit?.author?.date||''),
      message:String(x?.commit?.message||'').split('\n')[0].slice(0,220),
      actor:String(x?.author?.login||x?.committer?.login||x?.commit?.author?.name||'')
    }));
    return res.status(200).json({ok:true,events,note:'Durable repository-backed administration history. Runtime login events remain in server logs and are not exposed to browsers.'});
  }catch(e){return res.status(503).json({error:`Audit history unavailable: ${e.message||e}`})}
}

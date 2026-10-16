import { requireAccess } from './braintrust-auth.js';

const OWNER='kayoskaide-stack',REPO='ai-tournament',API='https://api.github.com';
const headers=token=>({Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'});
async function gh(path,token){const r=await fetch(`${API}/repos/${OWNER}/${REPO}${path}`,{headers:headers(token)});if(!r.ok)throw Error(`GitHub ${r.status}`);return r.json()}

export default async function deployAdmin(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  const user=requireAccess(req,res,'preview');if(!user)return;
  const token=String(process.env.ARENA_GITHUB_TOKEN||'');if(!token)return res.status(503).json({error:'Deployment status is unavailable.'});
  try{
    const [pulls,tags]=await Promise.all([
      gh('/pulls?state=open&per_page=25',token),
      gh('/git/matching-refs/tags/arena-backup-',token).catch(()=>[])
    ]);
    const openPullRequests=(Array.isArray(pulls)?pulls:[]).map(p=>({number:p.number,title:String(p.title||'').slice(0,140),head:p.head?.ref||'',base:p.base?.ref||'',sha:String(p.head?.sha||'').slice(0,12)}));
    const backups=(Array.isArray(tags)?tags:[]).map(t=>String(t.ref||'').replace('refs/tags/','')).filter(Boolean).sort().reverse().slice(0,30);
    return res.status(200).json({
      ok:true,
      environment:String(process.env.VERCEL_ENV||'unknown'),
      commit:String(process.env.VERCEL_GIT_COMMIT_SHA||'').slice(0,12)||'unknown',
      branch:String(process.env.VERCEL_GIT_COMMIT_REF||'unknown'),
      deploymentUrl:String(process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL||''),
      openPullRequests,backups,
      rollbackAllowed:user.capabilities.includes('rollback')
    });
  }catch(e){return res.status(503).json({error:`Deployment status unavailable: ${e.message||e}`})}
}

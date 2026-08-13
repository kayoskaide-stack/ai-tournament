import crypto from "node:crypto";

const OWNER="kayoskaide-stack",REPO="ai-tournament",API="https://api.github.com";
const editable=/^(app\.js|index\.html|styles\.css|README\.md|package\.json|api\/[a-z0-9._-]+\.js)$/i;
const headers=token=>({Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"});
const clean=s=>String(s||"").replace(/[^a-zA-Z0-9._/-]/g,"-").slice(0,120);

function authorized(req){
 const wanted=String(process.env.ARENA_ADMIN_KEY||""),got=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
 if(!wanted||wanted.length<16||got.length!==wanted.length)return false;
 return crypto.timingSafeEqual(Buffer.from(got),Buffer.from(wanted));
}
async function gh(path,options={}){
 const token=process.env.ARENA_GITHUB_TOKEN;if(!token)throw Error("ARENA_GITHUB_TOKEN is not configured");
 const r=await fetch(`${API}/repos/${OWNER}/${REPO}${path}`,{...options,headers:{...headers(token),...(options.headers||{})}}),raw=await r.text();
 let data={};try{data=raw?JSON.parse(raw):{}}catch{data={message:raw}}
 if(!r.ok)throw Error(`GitHub ${r.status}: ${data.message||raw.slice(0,180)}`);return data;
}
async function file(path,ref){
 const d=await gh(`/contents/${path}?ref=${encodeURIComponent(ref)}`);return {path,sha:d.sha,content:Buffer.from(d.content||"","base64").toString("utf8")};
}
async function codex(task,files){
 if(!process.env.OPENAI_API_KEY)throw Error("OPENAI_API_KEY is not configured");
 const prompt=`You are CodeSavant, a careful coding specialist for a small vanilla JavaScript Vercel application. Implement the operator request using the supplied repository files. Return JSON only with keys summary and files. files is an array of complete replacement files, each having path and content. Change the minimum number of files. Never output secrets, credentials, workflow files, binary files, or deletions. Preserve existing behavior, mobile layout, admin authentication, rigorous backup/preview/approval flow, and fail-closed safety. Every JavaScript file must parse.\n\nOPERATOR REQUEST:\n${task}\n\nFILES:\n${files.map(f=>`--- ${f.path} ---\n${f.content}`).join("\n")}`;
 const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.ARENA_CODER_MODEL||"gpt-5.5",messages:[{role:"user",content:prompt}],response_format:{type:"json_object"},max_completion_tokens:12000})}),raw=await r.text();
 let d={};try{d=JSON.parse(raw)}catch{}if(!r.ok)throw Error(`Coding model ${r.status}: ${d?.error?.message||raw.slice(0,180)}`);
 const text=d?.choices?.[0]?.message?.content;if(!text)throw Error("Coding model returned no patch");let out;try{out=JSON.parse(text)}catch{throw Error("Coding model returned invalid JSON")};return out;
}
async function propose(task){
 task=String(task||"").trim();if(task.length<8||task.length>1800)throw Error("Build request must be 8–1800 characters");
 const base=await gh("/git/ref/heads/main"),baseSha=base.object.sha,stamp=new Date().toISOString().replace(/[-:.TZ]/g,"").slice(0,14),backup=`arena-backup-${stamp}`,branch=`arena/autopilot-${stamp}`;
 await gh("/git/refs",{method:"POST",body:JSON.stringify({ref:`refs/tags/${backup}`,sha:baseSha})});
 const verified=await gh(`/git/ref/tags/${backup}`);if(verified.object.sha!==baseSha)throw Error("Backup verification failed — build cancelled");
 await gh("/git/refs",{method:"POST",body:JSON.stringify({ref:`refs/heads/${branch}`,sha:baseSha})});
 const paths=["app.js","index.html","styles.css","package.json","README.md","api/contestant.js","api/status.js","api/speak.js","api/transcribe.js"],source=[];
 for(const p of paths){try{source.push(await file(p,baseSha))}catch(e){if(!String(e.message).includes("404"))throw e}}
 const result=await codex(task,source),changes=Array.isArray(result.files)?result.files:[];
 if(!changes.length)throw Error("CodeSavant proposed no file changes");
 for(const change of changes){const path=String(change.path||"");if(!editable.test(path))throw Error(`Blocked unsafe path: ${path}`);const old=source.find(f=>f.path===path);if(!old)throw Error(`Only existing approved files may change tonight: ${path}`);if(typeof change.content!=="string"||change.content.length>600000)throw Error(`Invalid generated file: ${path}`);await gh(`/contents/${path}`,{method:"PUT",body:JSON.stringify({message:`Arena Auto-Pilot: ${task.slice(0,70)}`,content:Buffer.from(change.content).toString("base64"),sha:old.sha,branch})})}
 const pr=await gh("/pulls",{method:"POST",body:JSON.stringify({title:`🤖 Arena: ${task.slice(0,72)}`,head:branch,base:"main",body:`## Arena Auto-Pilot\n\n**Requested by:** Kyle\n\n${task}\n\n**CodeSavant summary:** ${String(result.summary||"Implementation prepared.").slice(0,1500)}\n\n**Rigorous backup:** \`${backup}\`\n\nProduction is unchanged until Kyle approves after checks and preview.`})});
 return {ok:true,stage:"preview",pr:pr.number,url:pr.html_url,branch,backup,summary:String(result.summary||"Implementation prepared.")};
}
async function status(prNumber){
 const pr=await gh(`/pulls/${Number(prNumber)}`),checks=await gh(`/commits/${pr.head.sha}/check-runs`),runs=(checks.check_runs||[]).map(x=>({name:x.name,status:x.status,conclusion:x.conclusion,url:x.html_url}));
 return {ok:true,pr:pr.number,state:pr.state,mergeable:pr.mergeable,sha:pr.head.sha,url:pr.html_url,checks:runs,ready:runs.length>0&&runs.every(x=>x.status==="completed"&&["success","neutral","skipped"].includes(x.conclusion))};
}
async function approve(prNumber){
 const st=await status(prNumber);if(!st.ready)throw Error("Required checks are not all successful yet");
 const merged=await gh(`/pulls/${Number(prNumber)}/merge`,{method:"PUT",body:JSON.stringify({merge_method:"squash",commit_title:`Arena Auto-Pilot PR #${Number(prNumber)}`})});if(!merged.merged)throw Error(merged.message||"GitHub did not merge the preview");return {ok:true,stage:"deploying",sha:merged.sha,message:"Merged. Vercel production deployment has started."};
}
async function reject(prNumber){
 const pr=await gh(`/pulls/${Number(prNumber)}`);await gh(`/pulls/${Number(prNumber)}`,{method:"PATCH",body:JSON.stringify({state:"closed"})});
 try{await gh(`/git/refs/heads/${clean(pr.head.ref)}`,{method:"DELETE"})}catch{}return {ok:true,stage:"rejected",message:"Preview rejected; production unchanged. Backup retained."};
}
async function rollback(backup){
 backup=clean(backup);if(!/^arena-backup-\d{14}$/.test(backup))throw Error("Invalid backup identifier");
 const tag=await gh(`/git/ref/tags/${backup}`),old=await gh(`/git/commits/${tag.object.sha}`),main=await gh("/git/ref/heads/main"),commit=await gh("/git/commits",{method:"POST",body:JSON.stringify({message:`Rollback production to ${backup}`,tree:old.tree.sha,parents:[main.object.sha]})});await gh("/git/refs/heads/main",{method:"PATCH",body:JSON.stringify({sha:commit.sha,force:false})});return {ok:true,stage:"rolling-back",sha:commit.sha,message:`Rollback commit created from ${backup}. Vercel is redeploying.`};
}

export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");if(req.method!=="POST")return res.status(405).json({error:"POST only"});if(!authorized(req))return res.status(401).json({error:"Administrator key rejected"});
 try{const {action,task,pr,backup}=req.body||{};const result=action==="propose"?await propose(task):action==="status"?await status(pr):action==="approve"?await approve(pr):action==="reject"?await reject(pr):action==="rollback"?await rollback(backup):(()=>{throw Error("Unknown Auto-Pilot action")})();return res.status(200).json(await result)}catch(e){return res.status(400).json({error:e instanceof Error?e.message:String(e)})}
}

(()=>{
  const PROFILE_KEY='BT_COUNCIL_PROFILE';
  const followup=/\b(?:another angle|other angles?|anything else|anything further|two cents|everyone.*(?:add|think)|anyone.*(?:add|angle)|anybody.*(?:add|angle))\b|autre (?:angle|chose)|quelqu.un.*ajouter/i;
  let installed=false,lastRound=null,catalog=null,loading=null;

  function selectedIds(){
    try{return JSON.parse(localStorage.getItem('BT_FREE_SELECTION')||'[]').filter(x=>typeof x==='string'&&x)}catch{return[]}
  }
  function profile(){return localStorage.getItem(PROFILE_KEY)||'standard'}
  function setProfile(v){if(!['standard','smart','deep'].includes(v))return;localStorage.setItem(PROFILE_KEY,v);syncProfileControl()}
  function syncProfileControl(){const s=document.querySelector('[data-bt-council-profile]');if(s)s.value=profile()}
  function installProfileControl(){
    const bar=document.querySelector('.btPowerBar');if(!bar||bar.querySelector('[data-bt-council-profile]'))return;
    const select=document.createElement('select');select.dataset.btCouncilProfile='1';select.title='Council spending / deliberation profile';select.style.minHeight='34px';
    [['standard','COUNCIL · STANDARD'],['smart','COUNCIL · SMART'],['deep','DEEP COUNCIL']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;select.appendChild(o)});
    select.value=profile();select.onchange=()=>setProfile(select.value);bar.appendChild(select);
  }
  async function discover(){
    if(catalog)return catalog;if(loading)return loading;
    loading=fetch('/api/gate?target=free-power',{cache:'no-store'}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Council model catalog unavailable.');catalog=d;return d}).finally(()=>loading=null);
    return loading;
  }
  function chooseBrains(models,ids){
    const chosen=[],families=new Set();
    for(const id of ids){const m=models.find(x=>x.id===id);if(!m||families.has(m.family))continue;chosen.push(m);families.add(m.family);if(chosen.length===3)break}
    if(chosen.length<3){for(const m of models){if(families.has(m.family))continue;chosen.push(m);families.add(m.family);if(chosen.length===3)break}}
    return chosen;
  }
  function currentHistory(){try{return S.history.slice(-10).map(x=>`${x.nick}: ${x.text}`).join('\n').slice(-10000)}catch{return''}}
  function images(){try{return pendingImages.slice()}catch{return[]}}
  function clearComposer(){try{input.value='';pendingImages=[];if(typeof renderPhotoTray==='function')renderPhotoTray()}catch{}}
  function nativeAddressed(raw){
    try{return Array.isArray(AI_META)&&AI_META.some(a=>new RegExp('^@?(?:'+[a.nick,...a.prefixes].join('|')+')[,:\\s]','i').test(raw))}catch{return false}
  }
  function setBusy(v){try{arenaBusy=v;document.querySelector('#send').disabled=v}catch{}}
  function addTyping(label){const n=document.createElement('div');n.className='typing';n.textContent=label;chat.appendChild(n);chat.scrollTop=chat.scrollHeight;return n}
  function addBrainMessage(m,d,index){
    add('message',m.name,`[${d.model} · FREE · ${(Number(d.latency||0)/1000).toFixed(1)}s]\n${d.guess}`);
    const line=chat.querySelector?.('.line.message:last-child');if(line){line.classList.add('btBrainMessage');line.dataset.model=d.model;line.dataset.participation=d.participation||'answered';line.dataset.councilSeat=String(index)}
  }
  async function askOne(m,{question,imgs,history,prior,mode,seat}){
    const response=await fetch('/api/gate?target=free-power',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:m.id,challenge:question,images:imgs,panel:true,mode,seat,history,prior}),signal:AbortSignal.timeout(45000)});
    const d=await response.json().catch(()=>({}));
    if(!response.ok||d.success!==true)throw Error(d.error||'Request unavailable');
    if(!d.guess||!d.model||!['answered','reviewed'].includes(d.participation))throw Error('Invalid council response.');
    return d;
  }
  async function runRound(raw){
    const d=await discover();if(!d.configured)throw Error('Council connection is unavailable.');
    const brains=chooseBrains(d.models||[],selectedIds());if(!brains.length)throw Error('No council brains are available.');
    const previous=lastRound?.channel===S.workspace.channel?lastRound:null;
    const isFollowup=Boolean(previous&&followup.test(raw));
    const question=isFollowup?`${previous.question}\nFollow-up request: ${raw}`:raw;
    const basePrior=isFollowup?previous.answers.slice(-8):[];
    const imgs=images(),history=currentHistory();
    add('message',S.nick,raw);clearComposer();
    notice(`${isFollowup?'Another-angle':'Panel'} round: ${brains.length} independent model families are thinking in parallel.`);
    const typing=addTyping(`${brains.length} independent brains are thinking…`);
    const calls=brains.map((m,i)=>askOne(m,{question,imgs,history,prior:basePrior.slice(),mode:isFollowup?'challenge':'review',seat:i})
      .then(data=>({ok:true,m,data,index:i})).catch(error=>({ok:false,m,error,index:i})));
    const rows=await Promise.all(calls);typing.remove();
    const answers=[];let failed=0;
    for(const row of rows.sort((a,b)=>a.index-b.index)){
      if(!row.ok){failed++;continue}
      const data=row.data;
      if(data.participation==='reviewed')continue;
      addBrainMessage(row.m,data,row.index);answers.push({model:data.model,text:data.guess});
    }
    lastRound={channel:S.workspace.channel,question:isFollowup?previous.question:raw,answers:[...basePrior,...answers].slice(-12)};
    if(!answers.length)throw Error('No independent council answer completed.');
    const summary=failed?`${answers.length} independent answers completed; ${failed} standby seat${failed===1?' was':'s were'} unavailable.`:`${answers.length} independent answers completed.`;
    notice(`Panel complete: ${summary} Final synthesis is next.`);
  }
  function install(){
    if(installed)return;
    if(typeof send!=='function'||typeof add!=='function'||typeof notice!=='function'||typeof S==='undefined'||!window.BrainTrustFreePower){setTimeout(install,80);return}
    installed=true;installProfileControl();
    const previousSend=send;
    send=async function(spokenText=''){
      const raw=String(typeof spokenText==='string'&&spokenText?spokenText:input?.value||'').trim();
      const freeMode=localStorage.getItem('BT_AI_MODE')!=='native';
      if(!freeMode||!raw||/^[!/]/.test(raw)||nativeAddressed(raw))return previousSend(spokenText);
      if(arenaBusy)return;
      setBusy(true);
      try{await runRound(raw)}catch(e){notice(e.message||String(e),'error')}
      finally{setBusy(false);try{input.focus()}catch{}}
    };
    document.querySelector('#send').onclick=()=>send();
    new MutationObserver(()=>{installProfileControl();syncProfileControl()}).observe(document.body,{subtree:true,childList:true});
    window.BrainTrustCouncil={get profile(){return profile()},setProfile,get lastRound(){return lastRound}};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

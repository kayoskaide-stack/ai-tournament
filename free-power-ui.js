(()=>{
 const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n};
 let catalog=null,loading=null,health=null,lastRound=null;const participation=new Map();const selected=new Set(JSON.parse(localStorage.getItem('BT_FREE_SELECTION')||'[]'));
 let enabled=localStorage.getItem('BT_AI_MODE')!=='native';
 const followup=/\b(?:another angle|other angles?|anything else|anything further|two cents|everyone.*(?:add|think)|anyone.*(?:add|angle)|anybody.*(?:add|angle))\b|autre (?:angle|chose)|quelqu.un.*ajouter/i;
 const tones=['#91d5ff','#a4a6ff','#70e1d8','#c5abff'];
 const bar=el('div','','btPowerBar'),modeButton=el('button'),rosterButton=el('button','BRAINS / ROSTER'),status=el('span','DISCOVERING FREE MODELS…');
 const angleButton=el('button','ANOTHER ANGLE?');angleButton.type='button';angleButton.disabled=true;angleButton.onclick=()=>send('Does anyone have another angle?');modeButton.type=rosterButton.type='button';bar.append(modeButton,rosterButton,angleButton,status);document.querySelector('.app header').prepend(bar);
 function setMode(){modeButton.textContent=enabled?'✦ FREE AI POWER':'◈ NATIVE PROVIDERS';modeButton.setAttribute('aria-pressed',String(enabled));document.body.classList.toggle('bt-free-power',enabled);localStorage.setItem('BT_AI_MODE',enabled?'free':'native')}
 modeButton.onclick=()=>{if(arenaBusy)return;enabled=!enabled;setMode();renderFreeRoster();angleButton.disabled=!enabled||!lastRound};setMode();
 async function discover(force=false){
  if(catalog&&!force)return catalog;if(loading)return loading;
  loading=(async()=>{const r=await fetch('/api/gate?target=free-power',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Catalog unavailable');catalog=d;try{const h=await fetch('/free-power-health.json',{cache:'no-store'});if(h.ok)health=await h.json()}catch{}
   const valid=new Set(d.models.map(m=>m.id));for(const id of selected)if(!valid.has(id))selected.delete(id);
   if(!selected.size){const verified=new Set((health?.checks||[]).filter(c=>c.verified).map(c=>c.model));const defaults=[...d.models.filter(m=>verified.has(m.id)),...(d.recommended||[])];const families=new Set();for(const m of defaults){if(families.has(m.family))continue;selected.add(m.id);families.add(m.family);if(selected.size===3)break;}}
   localStorage.setItem('BT_FREE_SELECTION',JSON.stringify([...selected]));
   status.textContent=d.configured?`${selected.size} SELECTED / ${d.models.length} FREE MODELS`:'FREE CONNECTION UNAVAILABLE';renderFreeRoster();updateMetrics();return d})().catch(e=>{status.textContent=e.message;throw e}).finally(()=>loading=null);return loading;
 }
 function renderFreeRoster(){
  const users=document.querySelector('#users');users.querySelector('.btFreeRoster')?.remove();if(!enabled||!catalog)return;
  const list=el('div','','btFreeRoster');list.append(el('small','FREE AI POWER'));
  [...selected].forEach((id,i)=>{const m=catalog.models.find(m=>m.id===id);if(!m)return;const b=el('button',m.name);b.style.setProperty('--brain-tone',tones[i%4]);b.title=id;const state=participation.get(id);if(state){const label=el('small',state.label);label.title=state.detail||'';b.append(label)}b.onclick=()=>{input.value='@'+m.family+' ';input.focus()};list.append(b)});users.prepend(list);
 }
 function updateMetrics(){if(!enabled)return;const metric=document.querySelector('.btHeroMetrics .btMetric');if(metric){const label=metric.querySelector('span'),value=metric.querySelector('b');if(label.textContent!=='SELECTED FREE BRAINS')label.textContent='SELECTED FREE BRAINS';if(value.textContent!==String(selected.size))value.textContent=String(selected.size)}}
 window.addEventListener('braintrust:message',()=>setTimeout(updateMetrics,0));new MutationObserver(updateMetrics).observe(document.querySelector('.btModuleHero'),{childList:true,subtree:true});
 const oldRender=render;render=function(){oldRender();renderFreeRoster();updateMetrics()};
 function openRoster(){
  wb('FREE AI POWER', '<div id="btFreeRosterPanel"><p>Each selected model receives a real request. After the first answer, others add something useful or explicitly report that they reviewed it and have nothing further to add. Use ANOTHER ANGLE? to ask everyone to reconsider.</p><p class="btPowerNote">Zero-priced inference via OpenRouter; shared free quotas apply. Select up to four brains. Native providers remain available using the mode button.</p><div id="btFreeModelGrid"></div><button id="btRefreshBrains">REFRESH DISCOVERY</button><p id="btFreeRosterResult" role="status"></p></div>');
  const draw=()=>{const grid=document.querySelector('#btFreeModelGrid');if(!grid||!catalog)return;grid.replaceChildren();catalog.models.forEach((m,i)=>{const card=el('label','','btFreeModel');card.style.setProperty('--brain-tone',tones[i%4]);const check=el('input');check.type='checkbox';check.checked=selected.has(m.id);check.disabled=!catalog.configured;check.onchange=()=>{if(check.checked&&selected.size>=4){check.checked=false;document.querySelector('#btFreeRosterResult').textContent='Select at most four brains per round.';return}check.checked?selected.add(m.id):selected.delete(m.id);localStorage.setItem('BT_FREE_SELECTION',JSON.stringify([...selected]));status.textContent=`${selected.size} SELECTED / ${catalog.models.length} FREE MODELS`;renderFreeRoster()};const checkResult=health?.checks?.find(c=>c.model===m.id);const text=el('div');text.append(el('b',m.name),el('small',m.id),el('small',`${Math.round(m.context/1000)}K CONTEXT · ${m.vision?'VISION':'TEXT'} · $0 INFERENCE`),el('small',checkResult?.verified?'LIVE CHECK PASSED':checkResult?'LAST CHECK: UNAVAILABLE':'NOT YET TESTED'));card.append(check,text);grid.append(card)});document.querySelector('#btFreeRosterResult').textContent=catalog.error||(!catalog.configured?'The OpenRouter connection is unavailable on this deployment.':'Choose your brains and return to the room.');};
  document.querySelector('#btRefreshBrains').onclick=()=>discover(true).then(draw).catch(e=>{document.querySelector('#btFreeRosterResult').textContent=e.message});discover().then(draw).catch(e=>{document.querySelector('#btFreeRosterResult').textContent=e.message});
 }
 rosterButton.onclick=openRoster;
 const legacySend=send;
 send=async function(spokenText=''){
  let raw=String(typeof spokenText==='string'&&spokenText?spokenText:input.value||'').trim();if(enabled&&!raw&&pendingImages.length)raw='Please examine the attached images.';
  if(!enabled||!raw||/^[!/]/.test(raw))return legacySend(spokenText);
  // Native names explicitly addressed by the user keep their established routing.
  if(AI_META.some(a=>new RegExp('^@?(?:'+[a.nick,...a.prefixes].join('|')+')[,:\\s]','i').test(raw)))return legacySend(spokenText);
  if(arenaBusy)return;
  arenaBusy=true;document.querySelector('#send').disabled=true;
  const images=pendingImages.slice();input.value='';pendingImages=[];if(typeof renderPhotoTray==='function')renderPhotoTray();
  try{
   await discover();if(!catalog.configured)throw Error('Free AI Power connection is unavailable.');
   let brains=catalog.models.filter(m=>selected.has(m.id));
   const addressed=raw.match(/^@([\w.-]+)\s/);if(addressed)brains=brains.filter(m=>m.family.toLowerCase()===addressed[1].toLowerCase());
   if(!brains.length)throw Error('Select at least one brain in BRAINS / ROSTER.');
   const previous=lastRound?.channel===S.workspace.channel?lastRound:null;
   const challenge=!!previous&&followup.test(raw);
   const question=challenge?`${previous.question}\nFollow-up request: ${raw}`:raw;
   const prior=challenge?previous.answers.slice():[];
   const history=S.history.slice(-10).map(x=>`${x.nick}: ${x.text}`).join('\n').slice(-10000);
   add('message',S.nick,raw);let answered=0,reviewed=0,failed=0;
   angleButton.disabled=true;
   for(const m of brains)participation.set(m.id,{label:'WAITING'});
   renderFreeRoster();
   notice(`${challenge?'Another-angle':'Panel'} round: asking ${brains.map(m=>m.name).join(', ')}. Each gets a separate request.`);
   const answers=[];
   for(let i=0;i<brains.length;i++){
    const m=brains[i],typing=el('div',`${m.name} is ${challenge?'reconsidering':prior.length?'reviewing':'thinking'}…`,'typing');chat.append(typing);chat.scrollTop=chat.scrollHeight;
    participation.set(m.id,{label:challenge?'RECONSIDERING':'THINKING'});renderFreeRoster();
    try{
     const response=await fetch('/api/gate?target=free-power',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:m.id,challenge:question,images,panel:true,mode:challenge?'challenge':'review',seat:i,history,prior}),signal:AbortSignal.timeout(45000)}),d=await response.json();
     if(!response.ok||d.success!==true)throw Error(d.error||'Request unavailable');
     if(!['answered','reviewed'].includes(d.participation)||!d.guess||!d.model)throw Error('Invalid panel response; no review was recorded.');
     if(d.participation==='reviewed'&&!prior.length)throw Error('No answer was available to review.');
     const isReview=d.participation==='reviewed';
     const label=isReview?'REVIEWED · NOTHING FURTHER TO ADD':'ANSWERED';
     add('message',m.name,`[${d.model} · FREE · ${(d.latency/1000).toFixed(1)}s]\n${isReview?'Reviewed — nothing further to add.\n':''}${d.guess}`);
     const line=chat.querySelector('.line.message:last-child');if(line){line.classList.add('btBrainMessage');line.style.setProperty('--brain-tone',tones[i%4]);line.dataset.model=d.model;line.dataset.participation=d.participation;}
     participation.set(m.id,{label,detail:d.guess});
     if(isReview)reviewed++;else{const answer={model:d.model,text:d.guess};prior.push(answer);answers.push(answer);answered++;}
    }catch(e){failed++;const reason=e.name==='TimeoutError'?'Request timed out. Try this brain again later.':e.message;participation.set(m.id,{label:'UNAVAILABLE · NOT REVIEWED',detail:reason});notice(`${m.name}: ${reason} No review or agreement recorded.`,'error')}
    finally{typing.remove();renderFreeRoster()}
   }
   // Only actual answers become reference material; failures never become reviews.
   lastRound={channel:S.workspace.channel,question:challenge?previous.question:raw,answers:[...(challenge?previous.answers:[]),...answers].slice(-8)};
   status.textContent=`${answered} ANSWERED · ${reviewed} REVIEWED · ${failed} UNAVAILABLE / ${brains.length} ASKED`;
   notice(`Panel complete: ${answered} answered, ${reviewed} reviewed with nothing further to add, ${failed} unavailable. Reviews are individual assessments, not proof of certainty.`);
   if(!answered&&!reviewed)notice('Free models are unavailable right now. Refresh the roster or retry later.','error');
  }catch(e){notice(e.message,'error')}
  finally{arenaBusy=false;document.querySelector('#send').disabled=false;angleButton.disabled=!lastRound||!enabled;input.focus()}
 };
 // Bind to the final dispatcher: the original app bound its earlier function by value.
 document.querySelector('#send').onclick=()=>send();
 window.BrainTrustFreePower={open:openRoster,refresh:()=>discover(true),get mode(){return enabled?'free':'native'}};
 window.addEventListener('braintrust:tools',()=>openTools());
 function openTools(){
  wb('RESEARCH / TOOL BAY','<div class="btToolBay"><p>Use the trusted IRC tools, or convert your own image to ASCII here.</p><div class="btToolButtons"><button data-tool="hunt">HUNT</button><button data-tool="catfish">CATFISH</button><button data-tool="ascii">ULTRA ASCII / RELAY</button></div><label>Local image → ASCII <input id="btAsciiFile" type="file" accept="image/*"></label><label>Width <input id="btAsciiWidth" type="range" min="30" max="140" value="80"></label><pre id="btAsciiOutput" aria-live="polite">Choose an image to begin.</pre><button id="btAsciiSave" disabled>DOWNLOAD ASCII</button></div>');
  document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{input.value='!'+b.dataset.tool+' ';document.querySelector('#workbench').hidden=true;input.focus()});let img=null,output='';
  const convert=()=>{if(!img)return;const w=+document.querySelector('#btAsciiWidth').value,h=Math.max(1,Math.round(img.height/img.width*w*.48)),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(img,0,0,w,h);const pixels=x.getImageData(0,0,w,h).data,chars='@%#*+=-:. ';let rows=[];for(let y=0;y<h;y++){let line='';for(let z=0;z<w;z++){const p=(y*w+z)*4,l=(pixels[p]*.2126+pixels[p+1]*.7152+pixels[p+2]*.0722)*pixels[p+3]/255;line+=chars[Math.min(9,Math.floor(l/256*10))]}rows.push(line)}output=rows.join('\n');document.querySelector('#btAsciiOutput').textContent=output;document.querySelector('#btAsciiSave').disabled=false};
  document.querySelector('#btAsciiFile').onchange=e=>{const f=e.target.files[0];if(!f)return;if(f.size>15000000){document.querySelector('#btAsciiOutput').textContent='Choose an image smaller than 15 MB.';return}const url=URL.createObjectURL(f);img=new Image();img.onload=()=>{URL.revokeObjectURL(url);convert()};img.onerror=()=>{URL.revokeObjectURL(url);document.querySelector('#btAsciiOutput').textContent='Could not read this image.'};img.src=url};
  document.querySelector('#btAsciiWidth').oninput=convert;document.querySelector('#btAsciiSave').onclick=()=>{const url=URL.createObjectURL(new Blob([output],{type:'text/plain'})),a=el('a');a.href=url;a.download='brain-trust-ascii.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 }
 discover().catch(()=>{});
})();

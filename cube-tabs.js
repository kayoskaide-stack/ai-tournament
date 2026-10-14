/* Native app integration: no extra AI calls or credentials on face selection. */
(()=>{
  const tabs=[
    {key:'lab',title:'Lab',subtitle:'IDEAS INTO REALITY',code:'01 / RESEARCH',colour:'#94ceff',topic:'Brain Trust Lab — experiment, build, and review projects.'},
    {key:'chat',title:'Chat Room',subtitle:'OPEN A CHANNEL',code:'02 / COMMS',colour:'#94ceff',topic:'Brain Trust Chat Room — talk and collaborate.'},
    {key:'tournament',title:'Tournament',subtitle:'INDEPENDENT MINDS. ONE ARENA.',code:'03 / ARENA',colour:'#94ceff',topic:S.topic},
    {key:'comedy',title:'Comedy Club · Laughly',subtitle:'THE LAUGHLY STAGE',code:'04 / LAUGHLY',colour:'#94ceff',topic:'Laughly — playful comedy, jokes, and human-awarded laugh scores.'},
    {key:'mission',title:'Mission Control',subtitle:'YOUR SYSTEMS AT A GLANCE',code:'05 / CONTROL',colour:'#94ceff'},
    {key:'audio',title:'Audio',subtitle:'SOUND. VOICE. IMAGINATION.',code:'06 / SOUND',colour:'#94ceff',topic:'Brain Trust Audio — music ideas, listening, and voice conversation.'}
  ];
  const app=document.querySelector('.app');
  const rooms=new Map();let selectedIndex=2,active='tournament',opened=false,transitioning=false,objectURL='',statusRound=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function node(tag,attrs={},text=''){const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));n.textContent=text;return n}
  const home=node('section',{id:'btCubeHome','aria-label':'Cube and Cosmos'}),frame=node('iframe',{src:'/cosmos/index.html',title:'Brain Trust interactive glass cube',id:'btCubeFrame'});
  home.append(frame);
  const panel=node('section',{id:'btCubePanel',hidden:'','aria-label':'Brain Trust tab'}),head=node('div',{class:'btCubeHead'}),back=node('button',{type:'button'},'‹ Cube'),title=node('h1'),quick=node('nav',{'aria-label':'Switch tab'}),tools=node('div',{id:'btTabTools'}),slot=node('div',{id:'btTabSlot'}),hero=node('div',{class:'btModuleHero'}),clock=node('span',{class:'btDeckClock'});
  tabs.forEach((tab,i)=>{const b=node('button',{type:'button','data-face':String(i)},tab.title.split(' · ')[0]);b.insertBefore(node('span',{class:'btNavNumber'},'0'+(i+1)),b.firstChild);b.onclick=()=>{if(!transitioning&&canSwitch()){panel.classList.remove('bt-sectors-open');sectors.setAttribute('aria-expanded','false');close(false);frame.contentWindow.postMessage({type:'braintrust:select-face',index:i},location.origin)}};quick.append(b)});
  const brand=node('span',{class:'btBrand'},'BRAIN TRUST / COMMAND DECK');const sectors=node('button',{id:'btSectorToggle',type:'button','aria-expanded':'false','aria-label':'Choose a Brain Trust sector'},'SECTORS ▾');sectors.onclick=()=>{const on=panel.classList.toggle('bt-sectors-open');sectors.setAttribute('aria-expanded',String(on))};head.append(back,title,brand,clock,sectors);panel.append(head,quick,hero,tools,slot);document.body.append(home,panel);slot.append(app);document.body.classList.add('bt-cube-home');
  const fallback=node('button',{id:'btCubeFallback',type:'button'},'COMMS / DIRECT ACCESS');fallback.onclick=()=>open(1,{x:innerWidth/2-80,y:innerHeight/2-80,width:160,height:160});home.append(fallback);
  // This entry also works when WebGL or the external Three.js CDN is unavailable.
  const homeButton=node('button',{id:'btReturnCube',type:'button'},'◇ CUBE');homeButton.onclick=()=>close();document.querySelector('.heading').append(homeButton);
  function canSwitch(){if(typeof arenaBusy!=='undefined'&&arenaBusy){notice('Please let this AI turn finish before switching tabs.');return false}if(typeof liveWanted!=='undefined'&&liveWanted){notice('Stop LIVE before switching tabs.');return false}return true}
  function storeRoom(){const scroll=chat.scrollTop;const nodes=document.createDocumentFragment();while(chat.firstChild)nodes.append(chat.firstChild);rooms.set(active,{nodes,history:S.history.slice(),topic:S.topic,channel:S.workspace.channel,scroll})}
  function room(tab){if(active===tab.key)return;storeRoom();active=tab.key;const saved=rooms.get(active);S.history=saved?saved.history.slice():[];S.topic=saved?saved.topic:tab.topic;S.workspace.channel=saved?saved.channel:tab.key==='tournament'?'ai-tournament':`braintrust-${tab.key}`;if(saved)chat.append(saved.nodes);else showJoinBanner(S.workspace.channel);save();render();chat.scrollTop=saved?saved.scroll:chat.scrollHeight}
  function button(text,action){const b=node('button',{type:'button'},text);b.onclick=action;tools.append(b);return b}
  function renderTools(tab){renderHero(tab);ensureEmpty(tab);tools.replaceChildren();tools.hidden=false;statusRound++;
    if(tab.key==='lab'){
      tools.append(node('p',{},'Experiment. Build. Turn the next idea into a project.'));
      button('Tool bay / HUNT / Catfish / ASCII',()=>window.dispatchEvent(new Event('braintrust:tools')));button('Projects',()=>projectMenu());button('Prepare proposal',()=>{input.value='/propose ';input.focus()});button('Images',()=>{input.value='!image ';input.focus()});
    }else if(tab.key==='tournament'){
      tools.append(node('p',{},'Set the question. Let independent AI voices challenge and refine it.'));
      button('Contestants / debate',()=>document.querySelector('#settingsBtn').click());
    }else if(tab.key==='comedy'){
      tools.append(node('p',{},'Ask for a joke. Award laughs. Watch the leaderboard.'));
      button('Laugh scores',()=>{renderScores();document.querySelector('#scoreboard').scrollIntoView({block:'nearest'})});
    }else if(tab.key==='mission'){
      const status=node('pre',{'aria-live':'polite'},'Reading provider status…');tools.append(status);
      button('Free AI Power',()=>window.BrainTrustFreePower?.open());button('Refresh',()=>refreshStatus(status,statusRound));button('Provider settings',()=>document.querySelector('#settingsBtn').click());button('Build console',()=>window.BrainTrustBuildConsole?.open());button('Workspace sizing',()=>document.querySelector('#layoutBtn').click());
      refreshStatus(status,statusRound);
    }else if(tab.key==='audio'){
      tools.append(node('p',{},'Open a voice channel or load your own audio.'));
      const file=node('input',{type:'file',accept:'audio/*','aria-label':'Choose a local audio file'}),audio=node('audio',{controls:'','aria-label':'Local audio player'});
      file.onchange=()=>{const chosen=file.files[0];if(!chosen)return;audio.pause();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(chosen);audio.src=objectURL};tools.append(file,audio);
      button('Voice conversation',()=>document.querySelector('#liveBtn').click());
      const label=node('label'),read=node('input',{type:'checkbox'});read.checked=!!S.settings.radioVoices;read.onchange=()=>{S.settings.radioVoices=read.checked;save();syncSettings()};label.append(read,document.createTextNode(' Read AI replies aloud'));tools.append(label);
    }else tools.hidden=true;
  }
  function ensureEmpty(tab){
    let empty=chat.querySelector('.btRoomEmpty');
    const descriptors={lab:['START AN EXPERIMENT','Bring a project, a sketch, or a question to the Lab.','Describe the project you want to build.'],chat:['OPEN THE CONVERSATION','Your independent AI teammates are one message away.','Ask the Brain Trust a question.'],tournament:['SET THE CHALLENGE','Give the arena a question worth debating.','Compare the strongest opposing answers to this question: '],comedy:['TAKE THE STAGE','A fresh room. A blank scorecard. Your first punchline.','Tell us an original joke.'],audio:['FIND YOUR SOUND','Music ideas, voice conversation, and your own audio.','Help me develop this music idea: ']};
    const d=descriptors[tab.key];if(!d)return;
    if(!empty){empty=node('div',{class:'btRoomEmpty'});empty.append(node('div',{class:'btEmptyGlyph','aria-hidden':'true'},'◇'),node('h3',{},d[0]),node('p',{},d[1]));const action=node('button',{type:'button'},tab.key==='lab'?'BEGIN IN THE LAB':tab.key==='comedy'?'OPEN THE STAGE':tab.key==='audio'?'START AN IDEA':'OPEN CHANNEL');action.onclick=()=>{input.focus();if(!input.value)input.placeholder=d[2]};empty.append(action);chat.append(empty)}
    empty.hidden=!!chat.querySelector('.line.message,.typing,.pilotCard');
  }
  new MutationObserver(()=>{const empty=chat.querySelector('.btRoomEmpty');if(empty)empty.hidden=!!chat.querySelector('.line.message,.typing,.pilotCard')}).observe(chat,{childList:true});
  function renderHero(tab){
    hero.replaceChildren();const intro=node('div',{class:'btHeroIntro'});intro.append(node('span',{class:'btEyebrow'},tab.code),node('h2',{},tab.subtitle),node('div',{class:'btHeroRule'}));
    const diagram=node('div',{class:'btModuleDiagram','aria-hidden':'true'});diagram.dataset.module=tab.key;
    const ring=node('div',{class:'btDiagramRing'}),ring2=node('div',{class:'btDiagramRing inner'}),core=node('b',{class:'btDiagramCore'},String(tabs.indexOf(tab)+1).padStart(2,'0'));
    diagram.append(ring,ring2,core);
    if(tab.key==='audio'||tab.key==='comedy'){const wave=node('div',{class:'btWave'});for(let i=0;i<26;i++){const bar=node('i');bar.style.setProperty('--bar',String(12+Math.abs(Math.sin(i*.73)*Math.cos(i*.21))*65));bar.style.setProperty('--phase',i*-.07+'s');wave.append(bar)}diagram.append(wave)}
    if(tab.key==='tournament'){const polygon=node('div',{class:'btArenaHex'});diagram.append(polygon)}
    const metrics=node('div',{class:'btHeroMetrics'}),ready=AI_META.filter(a=>providerReady[a.key]).length;
    const values=tab.key==='comedy'?[['LAUGH POINTS',Object.values(S.comedy.scores).reduce((n,v)=>n+(Number(v)||0),0)],['AWARDS',S.comedy.awards.length]]:[['AVAILABLE AIs',ready+'/'+AI_META.length],['ROOM MESSAGES',(S.workspace.logs[S.workspace.channel]||[]).length]];
    values.forEach(([label,value])=>{const m=node('div',{class:'btMetric'});m.append(node('span',{},label),node('b',{},String(value)));metrics.append(m)});hero.append(intro,diagram,metrics);
  }
  let previewSignature='';
  function sendTournamentPreview(force=false){
    const messages=(S.workspace.logs['ai-tournament']||[]).slice(-4).map(row=>({at:row.at,nick:row.nick,text:String(row.text||'').slice(0,1200)}));
    const signature=JSON.stringify(messages);if(!force&&signature===previewSignature)return;previewSignature=signature;
    frame.contentWindow.postMessage({type:'braintrust:channel-preview',channel:'ai-tournament',messages},location.origin);
  }
  frame.addEventListener('load',()=>sendTournamentPreview(true));
  window.addEventListener('braintrust:message',()=>sendTournamentPreview());
  window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data?.type==='braintrust:cube-ready')sendTournamentPreview(true)});
  window.addEventListener('braintrust:message',()=>renderHero(tabs.find(t=>t.key===active)||tabs[2]));
  function providerCards(){const grid=node('div',{class:'btProviderGrid'});AI_META.forEach(a=>{const state=S.providerState[a.key]||{},ready=providerReady[a.key],card=node('article',{class:'btProviderCard '+(ready?'available':'offline')});card.append(node('span',{class:'btProviderStatus'},ready?String(state.status||'ready').toUpperCase():'OFFLINE'),node('h3',{},a.nick),node('p',{},S.profiles[a.key]?.model||a.provider),node('small',{},state.reason||(ready?'Available':'API not configured')));grid.append(card)});return grid}
  let audioContext;
  function menuTone(){if(localStorage.getItem('BT_NAV_SOUND')==='off'||reduced.matches)return;try{const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;audioContext=audioContext||new Context();audioContext.resume().catch(()=>{});const osc=audioContext.createOscillator(),gain=audioContext.createGain(),t=audioContext.currentTime;osc.type='sine';osc.frequency.setValueAtTime(620,t);osc.frequency.exponentialRampToValueAtTime(390,t+.085);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.026,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+.1);osc.connect(gain).connect(audioContext.destination);osc.start(t);osc.stop(t+.11)}catch{}}
  const sound=node('button',{id:'btMenuSound',type:'button','aria-label':'Toggle menu sounds'},'SOUND');sound.setAttribute('aria-pressed',String(localStorage.getItem('BT_NAV_SOUND')!=='off'));sound.onclick=()=>{const on=localStorage.getItem('BT_NAV_SOUND')==='off';localStorage.setItem('BT_NAV_SOUND',on?'on':'off');sound.setAttribute('aria-pressed',String(on));sound.textContent=on?'SOUND ON':'SOUND OFF';if(on)menuTone()};head.append(sound);
  panel.addEventListener('pointerdown',e=>{if(e.target.closest('button')&&e.target.id!=='btMenuSound')menuTone()});
  const updateClock=()=>clock.textContent=new Date().toLocaleTimeString('en-GB',{hour12:false});updateClock();setInterval(updateClock,1000);
  async function refreshStatus(out,round){out.textContent='Reading provider status…';try{await checkProviders();if(round!==statusRound)return;tools.querySelector('.btProviderGrid')?.remove();tools.append(providerCards());out.textContent=AI_META.map(a=>`${a.nick}: ${providerReady[a.key]?(S.providerState[a.key]?.status||'ready'):'off'}${S.providerState[a.key]?.reason?' · '+S.providerState[a.key].reason:''}`).join('\n')}catch(e){if(round===statusRound)out.textContent=`Status unavailable: ${e.message}`}}
  function finish(){transitioning=false;panel.classList.remove('bt-opening');panel.classList.add('bt-entered');panel.inert=false;back.focus({preventScroll:true})}
  function animateFace(rect,image,reverse=false){
    // Flight and its delayed echoes are rendered by the actual 3D cube.
    // This last optical flash blends the face into its matching command screen.
    const flash=node('div',{class:'btOpticalFlash','aria-hidden':'true'});flash.style.setProperty('--tab-colour',tabs[selectedIndex].colour);document.body.append(flash);
    const a=flash.animate(reverse?[{opacity:0},{opacity:.45,offset:.4},{opacity:0}]:[{opacity:.65},{opacity:0}],{duration:reduced.matches?1:240,easing:'ease-out',fill:'both'});
    return Promise.race([a.finished.catch(()=>{}),new Promise(resolve=>setTimeout(resolve,reduced.matches?1:320))]).then(()=>flash.remove());
  }
  let faceRect=null,faceImage='';
  async function open(index,rect,image){if(opened||transitioning)return;if(!tabs[index]||!canSwitch()){frame.contentWindow.postMessage({type:'braintrust:face-close'},location.origin);return}transitioning=true;opened=true;const tab=tabs[index];selectedIndex=index;faceRect=rect;faceImage=image;title.textContent=tab.key==='comedy'?'Comedy Club':tab.title;panel.style.setProperty('--tab-colour',tab.colour);document.body.style.setProperty('--tab-colour',tab.colour);panel.hidden=false;panel.inert=true;panel.classList.remove('bt-entered','bt-closing','bt-sectors-open');sectors.setAttribute('aria-expanded','false');panel.classList.add('bt-opening');if(tab.topic)room(tab);renderTools(tab);panel.dataset.tab=tab.key;quick.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));document.body.classList.remove('bt-cube-home');document.body.classList.add('bt-cube-tab');await animateFace(rect,image);finish()}
  async function close(effect=true){if(!opened||transitioning)return;transitioning=true;opened=false;statusRound++;document.querySelectorAll('#settings,#shade,#workbench,#colourPicker,#layoutPanel').forEach(n=>n.hidden=true);panel.classList.add('bt-closing');frame.contentWindow.postMessage({type:'braintrust:face-close'},location.origin);if(effect&&!reduced.matches)await animateFace(faceRect,faceImage,true);panel.hidden=true;document.body.classList.remove('bt-cube-tab');document.body.classList.add('bt-cube-home');panel.classList.remove('bt-closing','bt-entered');transitioning=false;fallback.focus({preventScroll:true})}
  // Same-origin state handoff also covers a delayed cross-frame message.
  setInterval(()=>{if(opened||transitioning||document.hidden)return;try{const packet=frame.contentWindow.BrainTrustCubeNavigation?.read();if(packet&&Number.isInteger(packet.index))open(packet.index,packet.rect,packet.image)}catch{}},300);
  back.onclick=()=>close();addEventListener('keydown',e=>{if(e.key==='Escape'&&opened&&!transitioning)close()});
  addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=='braintrust:face-open')return;const {index,rect,image}=e.data;if(!Number.isInteger(index))return;open(index,rect,image)});
})();

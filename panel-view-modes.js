(()=>{
  const STORAGE_KEY='BT_PANEL_VIEW';
  const VALID=new Set(['normal','masked','hidden']);
  let installed=false,round=null,thinking=null,lastQuestion='';

  const mode=()=>{const v=localStorage.getItem(STORAGE_KEY)||'normal';return VALID.has(v)?v:'normal'};
  const setMode=v=>{if(!VALID.has(v))return;localStorage.setItem(STORAGE_KEY,v);document.body.dataset.panelView=v;updateSettingText()};
  const panelReply=/^\[([^\]\n]+?)\s+·\s+FREE\s+·[^\]]*\]\s*\n([\s\S]*)$/;

  function installStyle(){
    if(document.getElementById('bt-panel-view-style'))return;
    const s=document.createElement('style');s.id='bt-panel-view-style';s.textContent=`
      .btPanelViewSetting{display:grid!important;grid-template-columns:1fr;gap:5px;margin:12px 0!important;padding:11px!important;border:1px solid #43617a;border-radius:8px;background:#07111b}
      .btPanelViewSetting select{min-height:38px;background:#030a10;color:#d7ebfa;border:1px solid #52718b;border-radius:6px;padding:6px;font:11px ui-monospace,monospace}
      .btPanelViewSetting small{color:#87a4b9;font:9px/1.5 ui-monospace,monospace}
      .btPanelThinking{display:flex;align-items:center;gap:9px;color:#9ccfec!important;font:11px ui-monospace,monospace;padding:11px 12px!important;border-left:2px solid #75cfff;background:#07192b99}
      .btThinkingDots{display:inline-flex;gap:4px}.btThinkingDots i{display:block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.2;animation:btThinkDot 1.05s infinite ease-in-out}.btThinkingDots i:nth-child(2){animation-delay:.18s}.btThinkingDots i:nth-child(3){animation-delay:.36s}
      @keyframes btThinkDot{0%,70%,100%{opacity:.2;transform:translateY(0)}35%{opacity:1;transform:translateY(-3px)}}
      .btMaskedPanelLine{font-family:ui-monospace,monospace!important;letter-spacing:.07em;color:#7da8c7!important;opacity:.9;overflow-wrap:anywhere}
      .btFinalSynthesis{border-left:3px solid #9be7ff!important;background:linear-gradient(100deg,#08243fee,#081526e8)!important;padding:12px!important;box-shadow:inset 24px 0 70px -60px #9be7ff}
      @media(prefers-reduced-motion:reduce){.btThinkingDots i{animation:none;opacity:.75}}
    `;document.head.appendChild(s);
  }

  function updateSettingText(){
    const note=document.getElementById('btPanelViewNote');if(!note)return;
    note.textContent=mode()==='normal'
      ?'Normal: show the complete AI round-table and the final synthesis.'
      :mode()==='masked'
        ?'Masked: each AI turn appears only as ********; the final synthesis stays readable.'
        :'Hidden: show only a Thinking indicator until the final synthesis is ready.';
  }

  function installSetting(){
    if(document.getElementById('btPanelViewMode'))return;
    const settings=document.getElementById('settings');if(!settings)return;
    const label=document.createElement('label');label.className='btPanelViewSetting';
    const title=document.createElement('b');title.textContent='Round-table display';
    const select=document.createElement('select');select.id='btPanelViewMode';select.setAttribute('aria-label','Round-table display mode');
    [['normal','Normal — show the debate'],['masked','Masked — show ******** activity'],['hidden','Hidden — Thinking ••• only']].forEach(([value,text])=>{const o=document.createElement('option');o.value=value;o.textContent=text;select.appendChild(o)});
    select.value=mode();select.onchange=()=>setMode(select.value);
    const note=document.createElement('small');note.id='btPanelViewNote';
    label.append(title,select,note);
    const save=document.getElementById('saveSettings');settings.insertBefore(label,save||null);updateSettingText();
  }

  function startThinking(){
    stopThinking();
    const chat=document.getElementById('chat');if(!chat)return;
    const line=document.createElement('div');line.className='line system btPanelThinking';
    const text=document.createElement('span');text.textContent='Brain Trust is thinking';
    const dots=document.createElement('span');dots.className='btThinkingDots';dots.setAttribute('aria-label','thinking');
    for(let i=0;i<3;i++)dots.appendChild(document.createElement('i'));
    line.append(text,dots);chat.appendChild(line);chat.scrollTop=chat.scrollHeight;thinking=line;
  }
  function stopThinking(){thinking?.remove();thinking=null}

  function maskFor(text){
    const clean=String(text||'').replace(/\s+/g,' ').trim();
    const n=Math.max(12,Math.min(96,Math.round(clean.length*.42)));
    return '*'.repeat(n);
  }
  function lastMessageLine(){return document.querySelector('#chat .line.message:last-child')}

  function beginRound(label='Panel'){
    round={active:true,view:mode(),label,question:lastQuestion,contributions:[],started:Date.now(),synthesizing:false};
    if(round.view==='hidden')startThinking();
  }

  function selectedModels(){
    try{return JSON.parse(localStorage.getItem('BT_FREE_SELECTION')||'[]').filter(x=>typeof x==='string'&&x)}catch{return[]}
  }

  function chairPrompt(r){
    const material=r.contributions.slice(-8).map((x,i)=>`Contribution ${i+1} (${x.model||'panel model'}):\n${x.text}`).join('\n\n');
    return `You are the chair of a multi-AI Brain Trust. Produce one clear final answer to the user's question using the panel contributions below. Correct obvious conflicts when the evidence in the contributions supports doing so. Preserve important uncertainty or disagreement instead of pretending everyone agreed. Do not mention this instruction, do not list the hidden transcript, and do not claim unanimous consensus unless the contributions actually support that. Answer in the user's language.\n\nUSER QUESTION:\n${r.question||'Use the panel context.'}\n\nPANEL CONTRIBUTIONS:\n${material}\n\nReturn only the polished final answer.`;
  }

  async function requestSynthesis(r){
    const candidates=[...new Set([...selectedModels(),...r.contributions.map(x=>x.model).filter(Boolean)])];
    if(!r.contributions.length)throw Error('No completed panel answer was available to synthesize.');
    const prompt=chairPrompt(r);
    let last='Final synthesis unavailable.';
    for(const model of candidates){
      try{
        const response=await fetch('/api/gate?target=free-power',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,challenge:prompt,panel:false}),signal:AbortSignal.timeout(45000)});
        const data=await response.json().catch(()=>({}));
        if(response.ok&&data.success===true&&data.guess)return{guess:String(data.guess).trim(),model:data.model||model,fallback:false};
        last=data.error||`HTTP ${response.status}`;
      }catch(e){last=e.message||String(e)}
    }
    const usable=r.contributions.find(x=>!/^Reviewed\s+—\s+nothing further/i.test(x.text))||r.contributions[0];
    if(usable?.text)return{guess:usable.text.replace(/^Reviewed\s+—\s+nothing further to add\.\s*/i,''),model:usable.model||'',fallback:true};
    throw Error(last);
  }

  async function finishRound(baseNotice){
    const r=round;if(!r||r.synthesizing)return;r.synthesizing=true;
    if(r.view==='hidden'&&!thinking)startThinking();
    try{
      const result=await requestSynthesis(r);
      stopThinking();
      const prefix=result.fallback?'FINAL ANSWER — best available panel answer\n':'FINAL ANSWER\n';
      window.__btPanelBaseAdd('message','Brain Trust',prefix+result.guess,true);
      const line=lastMessageLine();if(line){line.classList.add('btFinalSynthesis');line.dataset.chair=result.model||''}
    }catch(e){
      stopThinking();baseNotice(`Brain Trust finished the round, but the final synthesis could not be produced: ${e.message||e}`,'error');
    }finally{
      if(round===r)round={...r,active:false,synthesizing:false};
    }
  }

  function install(){
    if(installed)return;
    if(typeof window.add!=='function'||typeof window.notice!=='function'||!window.BrainTrustFreePower){setTimeout(install,80);return}
    installed=true;installStyle();installSetting();document.body.dataset.panelView=mode();
    const baseAdd=window.add,baseNotice=window.notice;window.__btPanelBaseAdd=baseAdd;

    window.add=function(type,nick,text,keep=true){
      const str=String(text??'');
      if(type==='message'&&typeof S!=='undefined'&&nick===S.nick)lastQuestion=str;
      const hit=type==='message'?str.match(panelReply):null;
      if(!hit)return baseAdd(type,nick,text,keep);
      if(!round?.active)beginRound('Panel');
      const model=hit[1].trim(),body=hit[2].trim();
      round.contributions.push({model,nick:String(nick||''),text:body});
      if(round.view==='normal')return baseAdd(type,nick,text,keep);
      if(round.view==='masked'){
        baseAdd('message','********',maskFor(body),false);
        const line=lastMessageLine();line?.classList.add('btMaskedPanelLine');return;
      }
      // Hidden mode: leave an invisible DOM placeholder so the existing panel renderer
      // can safely tag its last message without exposing the speaker or text.
      baseAdd('message','',' ',false);const line=lastMessageLine();if(line)line.hidden=true;
    };

    window.notice=function(text,type='system'){
      const str=String(text||'');
      if(/^(?:Another-angle|Panel) round:/i.test(str)){
        beginRound(/^Another-angle/i.test(str)?'Another angle':'Panel');
        if(round.view==='normal')return baseNotice(text,type);
        return;
      }
      if(/^Panel complete:/i.test(str)){
        if(round?.view==='normal')baseNotice(text,type);
        finishRound(baseNotice);return;
      }
      if(round?.active&&round.view!=='normal'&&/(?:No review or agreement recorded|Reviewed|unavailable|rate limit|quota)/i.test(str))return;
      return baseNotice(text,type);
    };

    window.BrainTrustPanelView={get mode(){return mode()},setMode};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

(()=>{
  const STORAGE_KEY='BT_PANEL_VIEW';
  const VALID=new Set(['normal','masked','hidden']);
  let installed=false,round=null,thinking=null,lastQuestion='';
  const mode=()=>{const v=localStorage.getItem(STORAGE_KEY)||'normal';return VALID.has(v)?v:'normal'};
  const setMode=v=>{if(!VALID.has(v))return;localStorage.setItem(STORAGE_KEY,v);document.body.dataset.panelView=v;updateSettingText();syncQuickSelect()};
  const panelReply=/^\[([^\]\n]+?)\s+·\s+FREE\s+·[^\]]*\]\s*\n([\s\S]*)$/;

  function installStyle(){
    if(document.getElementById('bt-panel-view-style'))return;
    const s=document.createElement('style');s.id='bt-panel-view-style';s.textContent=`
      .btPanelViewSetting{display:grid!important;grid-template-columns:1fr;gap:5px;margin:12px 0!important;padding:11px!important;border:1px solid #43617a;border-radius:8px;background:#07111b}
      .btPanelViewSetting select,.btPanelQuick{min-height:38px;background:#030a10;color:#d7ebfa;border:1px solid #52718b;border-radius:6px;padding:6px;font:11px ui-monospace,monospace}
      .btPanelViewSetting small{color:#87a4b9;font:9px/1.5 ui-monospace,monospace}.btPanelQuick{min-height:34px;font-size:9px;max-width:190px}
      .btPanelThinking{display:flex;align-items:center;gap:9px;color:#9ccfec!important;font:11px ui-monospace,monospace;padding:11px 12px!important;border-left:2px solid #75cfff;background:#07192b99}
      .btThinkingDots{display:inline-flex;gap:4px}.btThinkingDots i{display:block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.2;animation:btThinkDot 1.05s infinite ease-in-out}.btThinkingDots i:nth-child(2){animation-delay:.18s}.btThinkingDots i:nth-child(3){animation-delay:.36s}
      @keyframes btThinkDot{0%,70%,100%{opacity:.2;transform:translateY(0)}35%{opacity:1;transform:translateY(-3px)}}
      .btMaskedPanelLine{font-family:ui-monospace,monospace!important;letter-spacing:.07em;color:#7da8c7!important;opacity:.9;overflow-wrap:anywhere;border-left:2px solid #5d9bc0;padding:7px!important;background:#07182a88}.btMaskedPanelLine .nick{color:#789eb8!important}
      .btFinalSynthesis{border-left:3px solid #9be7ff!important;background:linear-gradient(100deg,#08243fee,#081526e8)!important;padding:14px!important;box-shadow:inset 24px 0 70px -60px #9be7ff;white-space:pre-wrap!important;line-height:1.55!important;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}.btFinalSynthesis .nick{font-family:ui-monospace,monospace!important;color:#a9efff!important}
      .btReaderButton{display:block;margin:12px 0 2px 76px;min-height:38px;padding:8px 13px;border:1px solid #93c9e8;border-radius:8px;background:#eaf7ff;color:#082033;font:800 10px ui-monospace,monospace;letter-spacing:.04em}
      #btReaderShade{position:fixed;inset:0;z-index:100020;background:#000b;display:grid;place-items:center;padding:14px}
      #btReaderCard{box-sizing:border-box;width:min(850px,96vw);max-height:94vh;overflow:auto;background:#fff;color:#18212a;border-radius:16px;box-shadow:0 30px 120px #000c;padding:clamp(22px,5vw,58px);font:17px/1.7 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #btReaderCard h1{margin:0 0 8px;font-size:clamp(26px,5vw,42px);line-height:1.1;color:#0f1720}#btReaderCard .btReaderSub{margin:0 0 28px;color:#63717e;font-size:13px}
      #btReaderText{white-space:pre-wrap;overflow-wrap:anywhere}#btReaderCard .btReaderActions{position:sticky;top:-1px;display:flex;justify-content:flex-end;gap:8px;margin:-10px -10px 18px;padding:10px;background:#fffffff2;backdrop-filter:blur(8px)}
      #btReaderCard button{min-height:40px;border:1px solid #bbc7d0;border-radius:8px;background:#f5f7f9;color:#16212b;padding:8px 12px;font-weight:750}
      @media(max-width:700px){.btPanelQuick{min-height:44px;max-width:48vw;font-size:10px}.btFinalSynthesis{font-size:15px!important;line-height:1.6!important;padding:14px 11px!important}.btPanelThinking{font-size:10px}.btReaderButton{margin-left:8px;min-height:44px}#btReaderShade{padding:0}#btReaderCard{width:100vw;height:100dvh;max-height:none;border-radius:0;padding:24px 18px 80px;font-size:17px}}
      @media(prefers-reduced-motion:reduce){.btThinkingDots i{animation:none;opacity:.75}}
    `;document.head.appendChild(s);
  }
  function updateSettingText(){const note=document.getElementById('btPanelViewNote');if(!note)return;note.textContent=mode()==='normal'?'Full Debate: show every AI contribution and the final synthesis.':mode()==='masked'?'Masked Debate: the real discussion is retained, but each AI turn is displayed only as ********; the final synthesis stays readable.':'Final Answer Only: the discussion still happens and is retained, but only a Thinking indicator and the final synthesis are displayed.'}
  function syncQuickSelect(){const q=document.querySelector('.btPanelQuick');if(q)q.value=mode()}
  function installQuickSelect(){const bar=document.querySelector('.btPowerBar');if(!bar||bar.querySelector('.btPanelQuick'))return;const q=document.createElement('select');q.className='btPanelQuick';q.title='How much of the AI round-table should be visible?';[['normal','FULL DEBATE'],['masked','MASKED ★★★★★'],['hidden','FINAL ANSWER ONLY']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;q.append(o)});q.value=mode();q.onchange=()=>setMode(q.value);bar.insertBefore(q,bar.querySelector('span')||null)}
  function installSetting(){if(document.getElementById('btPanelViewMode'))return;const settings=document.getElementById('settings');if(!settings)return;const label=document.createElement('label');label.className='btPanelViewSetting';const title=document.createElement('b');title.textContent='Round-table display';const select=document.createElement('select');select.id='btPanelViewMode';select.setAttribute('aria-label','Round-table display mode');[['normal','Full Debate — show the discussion'],['masked','Masked Debate — show ******** activity'],['hidden','Final Answer Only — Thinking ••• then answer']].forEach(([value,text])=>{const o=document.createElement('option');o.value=value;o.textContent=text;select.appendChild(o)});select.value=mode();select.onchange=()=>setMode(select.value);const note=document.createElement('small');note.id='btPanelViewNote';label.append(title,select,note);const save=document.getElementById('saveSettings');settings.insertBefore(label,save||null);updateSettingText()}
  function startThinking(){stopThinking();const chat=document.getElementById('chat');if(!chat)return;const line=document.createElement('div');line.className='line system btPanelThinking';const text=document.createElement('span');text.textContent='Brain Trust round-table in progress — discussion hidden';const dots=document.createElement('span');dots.className='btThinkingDots';dots.setAttribute('aria-label','thinking');for(let i=0;i<3;i++)dots.appendChild(document.createElement('i'));line.append(text,dots);chat.appendChild(line);chat.scrollTop=chat.scrollHeight;thinking=line}
  function stopThinking(){thinking?.remove();thinking=null}
  function maskFor(text){const clean=String(text||'').replace(/\s+/g,' ').trim();return '*'.repeat(Math.max(12,Math.min(110,Math.round(clean.length*.55))))}
  function lastMessageLine(){return document.querySelector('#chat .line.message:last-child')}
  function beginRound(label='Panel'){round={active:true,view:mode(),label,question:lastQuestion,contributions:[],started:Date.now(),synthesizing:false};if(round.view==='hidden')startThinking()}
  function selectedModels(){try{return JSON.parse(localStorage.getItem('BT_FREE_SELECTION')||'[]').filter(x=>typeof x==='string'&&x)}catch{return[]}}

  function openReader(answer,model=''){
    document.getElementById('btReaderShade')?.remove();
    const shade=document.createElement('div');shade.id='btReaderShade';shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');shade.setAttribute('aria-label','Brain Trust final answer reader view');
    const card=document.createElement('article');card.id='btReaderCard';
    const actions=document.createElement('div');actions.className='btReaderActions';
    const copy=document.createElement('button');copy.type='button';copy.textContent='COPY ANSWER';copy.onclick=async()=>{try{await navigator.clipboard.writeText(answer);copy.textContent='COPIED ✓'}catch{copy.textContent='SELECT TEXT TO COPY'}};
    const close=document.createElement('button');close.type='button';close.textContent='CLOSE';close.onclick=()=>shade.remove();
    const title=document.createElement('h1');title.textContent='Brain Trust';
    const sub=document.createElement('p');sub.className='btReaderSub';sub.textContent=model?`Final synthesis · ${model}`:'Final synthesis';
    const body=document.createElement('div');body.id='btReaderText';body.textContent=answer;
    actions.append(copy,close);card.append(actions,title,sub,body);shade.append(card);document.body.append(shade);
    shade.addEventListener('click',e=>{if(e.target===shade)shade.remove()});close.focus();
  }
  function addReaderButton(answer,model){
    const chat=document.getElementById('chat');if(!chat)return;
    const b=document.createElement('button');b.type='button';b.className='btReaderButton';b.textContent='▣ OPEN CLEAN READER VIEW';b.onclick=()=>openReader(answer,model);chat.append(b);chat.scrollTop=chat.scrollHeight;
  }

  async function requestSynthesis(r){
    const candidates=[...new Set([...selectedModels(),...r.contributions.map(x=>x.model).filter(Boolean)])];
    if(!r.contributions.length)throw Error('No completed panel answer was available to synthesize.');
    let last='Final synthesis unavailable.';
    const prior=r.contributions.slice(-12).map(x=>({model:String(x.model||x.nick||'panel'),text:String(x.text||'').replace(/^Reviewed\s+—\s+nothing further to add\.\s*/i,'').trim()})).filter(x=>x.text);
    for(const model of candidates){
      try{
        const response=await fetch('/api/gate?target=free-power',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,challenge:r.question||'Use the panel context.',panel:true,mode:'synthesis',seat:0,history:'',prior}),signal:AbortSignal.timeout(45000)});
        const data=await response.json().catch(()=>({}));
        if(response.ok&&data.success===true&&data.guess&&data.identityVerified===true)return{guess:String(data.guess).trim(),model:data.model||model,fallback:false};
        last=data.error||`HTTP ${response.status}`;
      }catch(e){last=e.message||String(e)}
    }
    const usable=r.contributions.find(x=>!/^Reviewed\s+—\s+nothing further/i.test(x.text))||r.contributions[0];
    if(usable?.text)return{guess:usable.text.replace(/^Reviewed\s+—\s+nothing further to add\.\s*/i,''),model:usable.model||'',fallback:true};
    throw Error(last);
  }
  async function finishRound(baseNotice){const r=round;if(!r||r.synthesizing)return;r.synthesizing=true;if(r.view==='hidden'&&!thinking)startThinking();try{const result=await requestSynthesis(r);stopThinking();const prefix=result.fallback?'FINAL ANSWER — synthesis brain unavailable; showing the best completed panel answer\n\n':'FINAL ANSWER\n\n';window.__btPanelBaseAdd('message','Brain Trust',prefix+result.guess,true);const line=lastMessageLine();if(line){line.classList.add('btFinalSynthesis');line.dataset.chair=result.model||''}addReaderButton(result.guess,result.model||'')}catch(e){stopThinking();baseNotice(`Brain Trust finished the round, but the final synthesis could not be produced: ${e.message||e}`,'error')}finally{if(round===r)round={...r,active:false,synthesizing:false}}}

  function maskRenderedLine(line,body){if(!line)return;line.classList.add('btMaskedPanelLine');line.replaceChildren();const t=document.createElement('span');t.className='time';t.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});const n=document.createElement('span');n.className='nick';n.textContent='********';line.append(t,document.createTextNode(' <'),n,document.createTextNode('> '),document.createTextNode(maskFor(body)))}
  function install(){
    if(installed)return;
    if(typeof window.add!=='function'||typeof window.notice!=='function'||!window.BrainTrustFreePower){setTimeout(install,80);return}
    installed=true;installStyle();installSetting();installQuickSelect();document.body.dataset.panelView=mode();const baseAdd=window.add,baseNotice=window.notice;window.__btPanelBaseAdd=baseAdd;
    window.add=function(type,nick,text,keep=true){const str=String(text??'');if(type==='message'&&typeof S!=='undefined'&&nick===S.nick)lastQuestion=str;const hit=type==='message'?str.match(panelReply):null;if(!hit)return baseAdd(type,nick,text,keep);if(!round?.active)beginRound('Panel');const model=hit[1].trim(),body=hit[2].trim();round.contributions.push({model,nick:String(nick||''),text:body});baseAdd(type,nick,text,keep);const line=lastMessageLine();if(round.view==='masked')maskRenderedLine(line,body);else if(round.view==='hidden'&&line)line.hidden=true};
    window.notice=function(text,type='system'){const str=String(text||'');if(/^(?:Another-angle|Panel) round:/i.test(str)){beginRound(/^Another-angle/i.test(str)?'Another angle':'Panel');if(round.view==='normal')return baseNotice(text,type);return}if(/^Panel complete:/i.test(str)){if(round?.view==='normal')baseNotice(text,type);finishRound(baseNotice);return}if(round?.active&&round.view!=='normal'&&/(?:No review or agreement recorded|Reviewed|unavailable|rate limit|quota)/i.test(str))return;return baseNotice(text,type)};
    window.BrainTrustPanelView={get mode(){return mode()},setMode,openReader};
    new MutationObserver(()=>{installSetting();installQuickSelect()}).observe(document.body,{subtree:true,childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

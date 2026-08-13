const $=s=>document.querySelector(s),chat=$("#chat"),input=$("#input");
let S=JSON.parse(localStorage.getItem("AITirc")||"null")||{
 nick:"Kyle",topic:"Kyle, PrincessGPT and Gemmy enter the arena.",
 present:{PrincessGPT:1,Gemmy:1},banned:{},ops:{Kyle:1},voices:{},
 modes:{m:0,i:0},history:[]
};
S.settings=Object.assign({copyBlocks:true,challenge:true,rebuttal:true,autoTalk:true,radioVoices:false,exchanges:2,answerLength:"tiny",openaiPlan:"auto",geminiPlan:"auto",openaiModel:"gpt-5.6-terra",geminiModel:"gemini-3.6-flash",banterLevel:6,competitionLevel:6},S.settings||{});
if(!S.settings.defaultsV2){S.settings.radioVoices=false;S.settings.answerLength="tiny";S.settings.defaultsV2=1}
S.layout=Object.assign({fontSize:13,nickWidth:112,headerSize:52,composerSize:62,nicksCollapsed:false},S.layout||{});
S.comedy=Object.assign({scores:{PrincessGPT:0,Gemmy:0},comboNick:"",combo:0,awards:[]},S.comedy||{});
let providerReady={openai:true,gemini:true};
let pendingImages=[];
let liveWanted=false,liveRecorder=null,liveStream=null,liveChunks=[],liveMeter=null,liveFrame=0,liveSpeaking=false,liveLastVoice=0,liveStarted=0,arenaBusy=false;
const save=()=>localStorage.setItem("AITirc",JSON.stringify(S));
const safe=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const time=()=>new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const colour=n=>n===S.nick?"kyle":n==="PrincessGPT"?"princess":"gemmy";

function add(type,nick,text,keep=true){
 const d=document.createElement("div");d.className="line "+type;
 d.innerHTML=type==="message"
  ?`<span class=time>${time()}</span> &lt;<span class="nick ${colour(nick)}">${safe(nick)}</span>&gt; ${safe(text)}`
  :type==="action"
  ?`<span class=time>${time()}</span> * <span class=${colour(nick)}>${safe(nick)}</span> ${safe(text)}`
  :`<span class=time>${time()}</span> ${safe(text)}`;
 chat.appendChild(d);chat.scrollTop=chat.scrollHeight;
 if(type==="message"&&(nick==="PrincessGPT"||nick==="Gemmy")){
  const speaker=document.createElement("button");speaker.className="speakOne";speaker.textContent="🔊";speaker.title=`Read ${nick}'s message aloud`;speaker.setAttribute("aria-label",speaker.title);speaker.onclick=()=>radioSpeak(nick,text,true);d.appendChild(speaker);
  const bar=document.createElement("div");bar.className="laughBar";[["LOL",5],["LMAO",10],["LMFAO",20],["ROTFL",50]].forEach(([label,points])=>{const b=document.createElement("button");b.textContent=`${label} +${points}`;b.onclick=()=>awardLaugh(nick,points,label,d);bar.appendChild(b)});d.appendChild(bar);
 }
 if(type==="message"&&S.settings.copyBlocks){
  const raw=String(text),parts=raw.split(/```/);if(parts.length>1){
   d.innerHTML=`<span class=time>${time()}</span> &lt;<span class="nick ${colour(nick)}">${safe(nick)}</span>&gt; `;
   parts.forEach((part,i)=>{if(i%2){const pre=document.createElement("pre");pre.className="codebox";const code=part.replace(/^\w+\n/,"").trim();pre.textContent=code;const b=document.createElement("button");b.className="copyBtn";b.textContent="Copy";b.onclick=async()=>{await navigator.clipboard.writeText(code);b.textContent="Copied ✓";setTimeout(()=>b.textContent="Copy",1500)};pre.appendChild(b);d.appendChild(pre)}else d.appendChild(document.createTextNode(part))});
  }
 }
 if(keep&&(type==="message"||type==="action")){
  S.history.push({nick,text});S.history=S.history.slice(-20);save();
 }
}
function name(x){
 x=String(x||"").toLowerCase();
 if(["princess","princessgpt","chatgpt","gpt"].includes(x))return"PrincessGPT";
 if(["gemmy","gemini","gem"].includes(x))return"Gemmy";
 if(x==="kyle"||x===S.nick.toLowerCase())return S.nick;
}
function render(){
 let a=[S.nick,...["PrincessGPT","Gemmy"].filter(n=>S.present[n])];
 $("#users").innerHTML=a.map(n=>`<div class="user ${colour(n)}">${S.ops[n]?"@":S.voices[n]?"+":""}${safe(n)}</div>`).join("");
 $("#count").textContent=a.length;
 $("#topic").textContent="Topic: "+S.topic;
 renderScores();
}
function medalsFor(score){return `${score>=5?"🥉":""}${score>=10?"🥈":""}${score>=20?"🥇":""}${score>=50?"🏆":""}`||"—"}
function renderScores(){const el=$("#scoreboard");if(!el)return;const scores=S.comedy.scores,leader=scores.PrincessGPT===scores.Gemmy?"":scores.PrincessGPT>scores.Gemmy?"PrincessGPT":"Gemmy";el.innerHTML=`<div class="scoreTitle">😂 LAUGH LEAGUE</div>`+["PrincessGPT","Gemmy"].map(n=>`<div class="scoreRow ${leader===n?"leader":""}"><b class="${colour(n)}">${leader===n?"👑 ":""}${n}</b><br>${scores[n]} pts <span class="medals">${medalsFor(scores[n])}</span>${S.comedy.comboNick===n&&S.comedy.combo>1?`<br><span class="combo">🔥 ${S.comedy.combo}× combo</span>`:""}</div>`).join("")}
function awardLaugh(nick,points,label,line){S.comedy.scores[nick]=(S.comedy.scores[nick]||0)+points;if(S.comedy.comboNick===nick)S.comedy.combo++;else{S.comedy.comboNick=nick;S.comedy.combo=1}S.comedy.awards.push({nick,points,label,at:Date.now()});S.comedy.awards=S.comedy.awards.slice(-100);const p=document.createElement("span");p.className="pointPop";p.textContent=`${label}! +${points}${S.comedy.combo>1?` · ${S.comedy.combo}× COMBO`:""}`;line.appendChild(p);save();renderScores()}
function notice(x,type="system"){add(type,"",x,false)}
function compactError(nick,message){
 const m=String(message||"").toLowerCase();let reason=m.includes("quota")||m.includes("billing")||m.includes("credit")?"credits unavailable":m.includes("key")||m.includes("configured")?"not configured":m.includes("429")?"rate limited":"unavailable";
 notice(`⚠ ${nick} sits out — ${reason}.`,"error");
}
function help(){
 ["Commands: /me /topic /nick /whois /names",
  "/op /deop /voice /devoice /kick /ban /unban /invite",
  "/mode +m|-m · /mode +i|-i · /clear · /reset"
 ].forEach(x=>notice(x));
}
function command(raw){
 let p=raw.slice(1).trim().split(/\s+/),c=(p.shift()||"").toLowerCase(),r=p.join(" "),n=name(p[0]);
 if(c==="me"){if(r)add("action",S.nick,r);return}
 if(c==="help"){help();return}
 if(c==="topic"){if(r){S.topic=r;save();render();notice(`${S.nick} changed the topic to: ${r}`)}else notice("Topic: "+S.topic);return}
 if(c==="nick"){if(!r)return notice("Usage: /nick NewName","error");let old=S.nick;S.nick=r.slice(0,24);S.ops[S.nick]=1;save();render();return notice(`${old} is now known as ${S.nick}`)}
 if(c==="names"){return notice($("#users").innerText.replace(/\n/g," · "))}
 if(c==="whois"){return notice(n?`${n} — ${n===S.nick?"human operator":n==="PrincessGPT"?"OpenAI contestant":"Google Gemini contestant"}`:"No such nick",n?"system":"error")}
 if(["op","deop","voice","devoice"].includes(c)){
  if(!n)return notice("No such nick","error");
  if(c==="op")S.ops[n]=1;if(c==="deop"&&n!==S.nick)delete S.ops[n];
  if(c==="voice")S.voices[n]=1;if(c==="devoice")delete S.voices[n];
  save();render();return notice(`${S.nick} sets ${c} on ${n}`);
 }
 if(c==="kick"){
  if(!n||n===S.nick)return notice("That user cannot be kicked","error");
  S.present[n]=0;save();render();return notice(`${n} was kicked by ${S.nick}${p.slice(1).length?" ("+p.slice(1).join(" ")+")":""}`);
 }
 if(c==="ban"||c==="unban"){
  if(!n||n===S.nick)return notice("That ban cannot be set","error");
  S.banned[n]=c==="ban";if(c==="ban")S.present[n]=0;
  save();render();return notice(`${S.nick} ${c==="ban"?"banned":"unbanned"} ${n}`);
 }
 if(c==="invite"){
  if(!n||n===S.nick)return notice("No such AI contestant","error");
  if(S.banned[n])return notice(`${n} is banned. Use /unban ${n} first.`,"error");
  S.present[n]=1;save();render();return notice(`${n} joined #ai-tournament`);
 }
 if(c==="mode"){
  let m=p[0];
  if(m==="+m")S.modes.m=1;else if(m==="-m")S.modes.m=0;
  else if(m==="+i")S.modes.i=1;else if(m==="-i")S.modes.i=0;
  else return notice(`Modes: ${S.modes.m?"+m":"-m"} ${S.modes.i?"+i":"-i"}`);
  save();return notice(`${S.nick} sets mode ${m} on #ai-tournament`);
 }
 if(c==="clear"){chat.innerHTML="";return}
 if(c==="reset"){localStorage.removeItem("AITirc");location.reload();return}
 notice(`Unknown command /${c}. Try /help`,"error");
}

let radioQueue=Promise.resolve();
async function radioSpeak(nick,text,force=false){
 if(!force&&!S.settings.radioVoices)return;
 const provider=nick==="PrincessGPT"?"openai":"gemini";
 radioQueue=radioQueue.then(async()=>{
  const res=await fetch("/api/speak",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider,text:String(text).slice(0,4000)})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||`Voice HTTP ${res.status}`);
  const audio=new Audio(`data:${data.mime};base64,${data.audio}`);
  await audio.play();
  await new Promise(resolve=>{audio.onended=resolve;audio.onerror=resolve});
 }).catch(e=>notice(`📻 ${nick} voice error: ${e.message}`,"error"));
 return radioQueue;
}

async function ask(provider,nick,userText,images=[]){
 if(!S.present[nick]||S.banned[nick])return;
 const plan=S.settings[provider+"Plan"]||"auto";
 if(plan==="off"||!providerReady[provider])return;
 if(S.modes.m&&!S.ops[nick]&&!S.voices[nick])
  return notice(`${nick} cannot speak while channel mode +m is active.`);
 const t=document.createElement("div");t.className="typing";
 t.textContent=`${nick} is typing…`;chat.appendChild(t);chat.scrollTop=chat.scrollHeight;
 const recent=S.history.slice(-12).map(x=>`${x.nick}: ${x.text}`).join("\n");
 const persona=nick==="PrincessGPT"
  ?"You are PrincessGPT: clever, warm, funny, direct, and Kyle's longtime AI teammate."
  :"You are Gemmy, the Gemini contestant: inventive, playful, competitive, and friendly.";
 const prompt=`${persona}
You are chatting live inside #ai-tournament with Kyle and another AI.
PrincessGPT is ChatGPT from OpenAI. Gemmy is Gemini from Google. You both know exactly who the other AI is and may address each other by name.
Verified shared memory about Kyle:
- Kyle lives and works around Newmarket, Aurora, Oak Ridges, and Stouffville in Ontario.
- Kyle is a window cleaner and often works very long days.
- Kyle calls large one-paste iSH commands SEMICOLON RAIN.
- Kyle prefers one complete paste, large obvious controls, and simple visual confirmation because his iPhone touch screen is unreliable.
- PrincessGPT is his longtime OpenAI teammate. Gemmy is his nickname for Google Gemini and an old friend from the caffeinated toddler days.
- Real projects include PrincessGPT Alpine, Catfish 9000 public-profile research, PlusOne iSH companion, the CS2000 compressor enclosure, ESP32 Sentinel Audio, the rooftop vine privacy wall, and the Dawn-handle steel-wool tool.
- Kyle likes playful banter, technical experiments, IRC culture, and turning absurd difficulties into running jokes.
- Never invent a shared memory or pretend an imaginary project happened. If a fact is not in this memory or the visible recent chat, honestly say you do not remember it.
Do not merely agree. ${S.settings.challenge?"Examine the other AI's reasoning, name a concrete weakness or improvement when one exists, and address the other AI by name.":"Collaborate naturally."}
${S.settings.rebuttal?"Before accepting a technical proposal, either challenge one detail or explain specifically why it survives scrutiny.":""}
Comical banter level is ${S.settings.banterLevel}/10. ${S.settings.banterLevel?"Use playful, affectionate jokes and wit; never become cruel or personally insulting.":"Keep banter off."}
Competitive one-upmanship level is ${S.settings.competitionLevel}/10. ${S.settings.competitionLevel?"Try to improve on the other AI's answer and comically point out a real flaw when one exists. Critique the answer, never the human.":"Do not compete."}
Reply naturally as ${nick}. Finish every sentence and thought; never end mid-sentence.
${S.settings.answerLength==="tiny"?"Keep the entire reply to 1–3 short sentences (about 60 words maximum).":S.settings.answerLength==="short"?"Keep the reply concise, normally under 120 words.":"Use only as much detail as needed."}
Never prefix the reply with your name.
Topic: ${S.topic}
Recent chat:
${recent}
Kyle's newest message: ${userText}`;
 try{
  const res=await fetch("/api/contestant",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({provider,model:S.settings[provider+"Model"],challenge:prompt,images,mode:"chat"})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||`HTTP ${res.status}`);
  let answer=data.guess||data.answer||data.text||data.output||data.response||
   data.content||data.result||data.reply;
  if(answer&&typeof answer!=="string")answer=JSON.stringify(answer);
  if(!answer)throw Error("No readable message returned");
  t.remove();add("message",nick,answer);await radioSpeak(nick,answer);return answer;
 }catch(e){t.remove();providerReady[provider]=false;compactError(nick,e.message);renderProviderStatus()}
}

async function send(spokenText=""){
  const raw=String(spokenText||input.value).trim();if(!raw&&!pendingImages.length)return;input.value="";
  if(raw.startsWith("/"))return command(raw);
  const images=pendingImages.slice(),requestText=raw||`Please examine these ${images.length} picture${images.length==1?"":"s"}.`;
  add("message",S.nick,raw||`📷 ${images.length} picture${images.length==1?"":"s"}`);pendingImages=[];renderPhotoTray();
  if(images.length){const box=document.createElement("div");box.className="attachment multi";images.forEach((src,i)=>{const img=document.createElement("img");img.src=src;img.alt=`Kyle's uploaded picture ${i+1}`;box.appendChild(img)});chat.appendChild(box);chat.scrollTop=chat.scrollHeight}
  const button=$("#send");button.disabled=true;arenaBusy=true;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    const princess=await ask("openai","PrincessGPT",requestText,images);
    await pause(1200);
    let last=await ask("gemini","Gemmy",`Kyle said: ${requestText}\nPrincessGPT proposed: ${princess||"(no reply)"}. Address PrincessGPT by name. Challenge or improve one concrete point; do not simply agree.`,images);
    if(S.settings.autoTalk){for(let round=1;round<Number(S.settings.exchanges);round++){await pause(1200);last=await ask("openai","PrincessGPT",`Gemmy replied: ${last||"(no reply)"}. Address Gemmy directly. Defend, revise, or replace the proposal with concrete reasoning.`,[]);await pause(1200);last=await ask("gemini","Gemmy",`PrincessGPT replied: ${last||"(no reply)"}. Give a concise final critique or agreement with a specific reason, then return control to Kyle.`,[])}}
  }finally{button.disabled=false;arenaBusy=false;input.focus();if(liveWanted)setTimeout(startLiveListening,500)}
}
$("#send").onclick=send;
input.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();send()}};
const syncSettings=()=>{for(const k of ["copyBlocks","challenge","rebuttal","autoTalk","radioVoices"])$("#"+k).checked=!!S.settings[k];for(const k of ["exchanges","answerLength","openaiPlan","geminiPlan","openaiModel","geminiModel","banterLevel","competitionLevel"])$("#"+k).value=String(S.settings[k]);syncLevelOutputs();renderProviderStatus()};
const closeSettings=()=>{$("#settings").hidden=true;$("#shade").hidden=true};
$("#settingsBtn").onclick=()=>{syncSettings();$("#settings").hidden=false;$("#shade").hidden=false};$("#closeSettings").onclick=$("#shade").onclick=closeSettings;
$("#saveSettings").onclick=()=>{for(const k of ["copyBlocks","challenge","rebuttal","autoTalk","radioVoices"])S.settings[k]=$("#"+k).checked;for(const k of ["exchanges","banterLevel","competitionLevel"])S.settings[k]=Number($("#"+k).value);for(const k of ["answerLength","openaiPlan","geminiPlan","openaiModel","geminiModel"])S.settings[k]=$("#"+k).value;providerReady.openai=S.settings.openaiPlan!=="off";providerReady.gemini=S.settings.geminiPlan!=="off";save();closeSettings();checkProviders();notice("Settings saved.")};
function syncLevelOutputs(){$("#banterOut").textContent=$("#banterLevel").value;$("#competitionOut").textContent=$("#competitionLevel").value}$("#banterLevel").oninput=$("#competitionLevel").oninput=syncLevelOutputs;
function liveLabel(text,on=false){const b=$("#liveBtn");b.textContent=text;b.classList.toggle("liveOn",on)}
function stopLiveHardware(){cancelAnimationFrame(liveFrame);liveFrame=0;if(liveRecorder&&liveRecorder.state!=="inactive")liveRecorder.stop();if(liveStream)liveStream.getTracks().forEach(t=>t.stop());liveRecorder=null;liveStream=null;if(liveMeter)liveMeter.close().catch(()=>{});liveMeter=null}
async function transcribeLive(blob){
 liveLabel("⏳ HEARING…",true);
 const bytes=new Uint8Array(await blob.arrayBuffer());let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 const res=await fetch("/api/transcribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({audio:btoa(binary),mime:blob.type||"audio/mp4"})});
 const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||`Transcription HTTP ${res.status}`);return String(data.text||"").trim();
}
async function finishLiveTurn(){
 if(!liveRecorder||liveRecorder.state==="inactive")return;const recorder=liveRecorder;
 recorder.onstop=async()=>{const blob=new Blob(liveChunks,{type:recorder.mimeType||"audio/mp4"});stopLiveHardware();if(!liveWanted)return;try{const words=await transcribeLive(blob);if(words){liveLabel("📻 AIs TALKING",true);await send(words)}else startLiveListening()}catch(e){notice(`🎙 Live mode error: ${e.message}`,"error");liveWanted=false;liveLabel("🎙 LIVE")}};
 recorder.stop();
}
async function startLiveListening(){
 if(!liveWanted||arenaBusy||liveRecorder)return;
 try{
  liveStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  liveChunks=[];liveRecorder=new MediaRecorder(liveStream);liveRecorder.ondataavailable=e=>{if(e.data.size)liveChunks.push(e.data)};liveRecorder.start(250);
  liveMeter=new (window.AudioContext||window.webkitAudioContext)();const src=liveMeter.createMediaStreamSource(liveStream),an=liveMeter.createAnalyser();an.fftSize=512;src.connect(an);const levels=new Uint8Array(an.fftSize);liveStarted=performance.now();liveSpeaking=false;liveLastVoice=liveStarted;liveLabel("🔴 LISTENING",true);
  const watch=()=>{if(!liveWanted||!liveRecorder)return;an.getByteTimeDomainData(levels);let sum=0;for(const v of levels){const x=(v-128)/128;sum+=x*x}const rms=Math.sqrt(sum/levels.length),now=performance.now();if(rms>.035){liveSpeaking=true;liveLastVoice=now;liveLabel("🟢 HEARING YOU",true)}else if(liveSpeaking&&now-liveLastVoice>1100){finishLiveTurn();return}else if(!liveSpeaking&&now-liveStarted>30000){liveStarted=now}liveFrame=requestAnimationFrame(watch)};watch();
 }catch(e){liveWanted=false;stopLiveHardware();liveLabel("🎙 LIVE");notice(`Microphone unavailable: ${e.message}`,"error")}
}
$("#liveBtn").onclick=()=>{liveWanted=!liveWanted;if(liveWanted){notice("🎙 LIVE mode on — talk naturally, then pause.");startLiveListening()}else{stopLiveHardware();liveLabel("🎙 LIVE");notice("🎙 LIVE mode off.")}};

$("#auditionPrincess").onclick=()=>radioSpeak("PrincessGPT","Hello Kyle. PrincessGPT is on the air, coming through loud and clear.",true);
$("#auditionGemmy").onclick=()=>radioSpeak("Gemmy","Hello Kyle. Gemmy is back from England and reporting live from the arena.",true);
function renderPhotoTray(){const tray=$("#attachmentTray");tray.hidden=!pendingImages.length;tray.innerHTML="";pendingImages.forEach((src,i)=>{const d=document.createElement("div");d.className="photoThumb";d.innerHTML=`<img src="${src}" alt="Attachment ${i+1}"><button class="removePhoto" aria-label="Remove picture ${i+1}">×</button>`;d.querySelector("button").onclick=()=>{pendingImages.splice(i,1);renderPhotoTray()};tray.appendChild(d)});if(pendingImages.length){const n=document.createElement("span");n.className="photoCount";n.textContent=`${pendingImages.length}/10`;tray.appendChild(n)}$("#photoBtn").textContent=pendingImages.length?`📎${pendingImages.length}`:"📎"}
function shrinkPhoto(file){return new Promise((resolve,reject)=>{if(file.size>20e6)return reject(Error("over 20 MB"));const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const scale=Math.min(1,1000/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL("image/jpeg",.68))};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("could not read picture"))};img.src=url})}
$("#photoBtn").onclick=()=>$("#photo").click();$("#photo").onchange=async e=>{const files=[...e.target.files],room=10-pendingImages.length;if(!room){notice("10-picture maximum reached.","error");e.target.value="";return}for(const f of files.slice(0,room)){try{const data=await shrinkPhoto(f),bytes=pendingImages.reduce((n,x)=>n+x.length,0)+data.length;if(bytes>3800000){notice("Picture tray is full by upload size. Remove one to add another.","error");break}pendingImages.push(data)}catch(err){notice(`Picture skipped — ${err.message}.`,"error")}}e.target.value="";renderPhotoTray();if(pendingImages.length)notice(`${pendingImages.length} picture${pendingImages.length==1?"":"s"} ready for both AIs.`)};

function renderProviderStatus(){
 const el=$("#providerStatus");if(!el)return;
 const chip=(name,key)=>`<span class="providerChip ${providerReady[key]?"on":"off"}">${providerReady[key]?"●":"○"} ${name}: ${providerReady[key]?(S.settings[key+"Plan"]||"auto"):"sitting out"}</span>`;
 el.innerHTML=chip("PrincessGPT","openai")+chip("Gemmy","gemini");
}
async function checkProviders(){
 try{const r=await fetch("/api/status",{cache:"no-store"}),d=await r.json();const configured=(d.configured||[]).map(x=>x.toLowerCase());providerReady.openai=S.settings.openaiPlan!=="off"&&configured.includes("openai");providerReady.gemini=S.settings.geminiPlan!=="off"&&configured.includes("gemini")}catch{}
 renderProviderStatus();render();
}
function applyLayout(){
 const r=document.documentElement.style;r.setProperty("--chat-font",S.layout.fontSize+"px");r.setProperty("--nick-width",S.layout.nickWidth+"px");r.setProperty("--header-height",S.layout.headerSize+"px");r.setProperty("--composer-height",S.layout.composerSize+"px");document.body.classList.toggle("nicksCollapsed",!!S.layout.nicksCollapsed);
 for(const [id,key] of [["fontSize","fontSize"],["nickWidth","nickWidth"],["headerSize","headerSize"],["composerSize","composerSize"]])if($("#"+id))$("#"+id).value=S.layout[key];
}
function layoutMode(on){document.body.classList.toggle("layoutEditing",on);$("#layoutPanel").hidden=!on;$("#layoutBtn").hidden=on;$("#layoutDone").hidden=!on;$("#layoutReset").hidden=!on}
$("#layoutBtn").onclick=()=>layoutMode(true);$("#layoutDone").onclick=()=>{save();layoutMode(false)};$("#layoutReset").onclick=()=>{S.layout={fontSize:13,nickWidth:112,headerSize:52,composerSize:62,nicksCollapsed:false};applyLayout();save()};
for(const [id,key] of [["fontSize","fontSize"],["nickWidth","nickWidth"],["headerSize","headerSize"],["composerSize","composerSize"]])$("#"+id).oninput=e=>{S.layout[key]=Number(e.target.value);applyLayout()};
$("#collapseNicks").onclick=()=>{S.layout.nicksCollapsed=!S.layout.nicksCollapsed;applyLayout();save()};
const ua=navigator.userAgent,ios=(ua.match(/OS (\d+)[_.](\d+)/)||[]).slice(1,3).join(".");$("#deviceBadge").textContent=/iPhone|iPad|iPod/.test(ua)?`iOS ${ios||"device"}`:/Android/.test(ua)?"Android":innerWidth<700?"Mobile":"Desktop";document.documentElement.dataset.device=innerWidth<700?"mobile":"desktop";
applyLayout();checkProviders();
render();
notice(`*** ${S.nick} joined #ai-tournament`);
notice("*** Arena ready. Unavailable AIs quietly sit out. Type /help for commands.");

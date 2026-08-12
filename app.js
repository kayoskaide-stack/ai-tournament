const $=s=>document.querySelector(s),chat=$("#chat"),input=$("#input");
let S=JSON.parse(localStorage.getItem("AITirc")||"null")||{
 nick:"Kyle",topic:"Kyle, PrincessGPT and Gemmy enter the arena.",
 present:{PrincessGPT:1,Gemmy:1},banned:{},ops:{Kyle:1},voices:{},
 modes:{m:0,i:0},history:[]
};
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
}
function notice(x,type="system"){add(type,"",x,false)}
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

async function ask(provider,nick,userText){
 if(!S.present[nick]||S.banned[nick])return;
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
Reply naturally as ${nick}, usually under 140 words.
Never prefix the reply with your name.
Topic: ${S.topic}
Recent chat:
${recent}
Kyle's newest message: ${userText}`;
 try{
  const res=await fetch("/api/contestant",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({provider,challenge:prompt,mode:"chat"})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||`HTTP ${res.status}`);
  let answer=data.guess||data.answer||data.text||data.output||data.response||
   data.content||data.result||data.reply;
  if(answer&&typeof answer!=="string")answer=JSON.stringify(answer);
  if(!answer)throw Error("No readable message returned");
  t.remove();add("message",nick,answer);
 }catch(e){t.remove();notice(`${nick} connection error: ${e.message}`,"error")}
}

async function send(){
 const raw=input.value.trim();if(!raw)return;input.value="";
 if(raw.startsWith("/"))return command(raw);
 add("message",S.nick,raw);
 await Promise.all([
  ask("openai","PrincessGPT",raw),
  ask("gemini","Gemmy",raw)
 ]);
}
$("#send").onclick=send;
input.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();send()}};
render();
notice(`*** ${S.nick} joined #ai-tournament`);
notice("*** PrincessGPT and Gemmy connected. Type /help for commands.");

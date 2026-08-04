const C=[
{name:"ChatGPT",role:"The Analyst",emoji:"🤖",color:"#6ba8ff",provider:"openai"},
{name:"Gemini",role:"The Explorer",emoji:"💎",color:"#b58cff",provider:"gemini"},
{name:"Claude",role:"The Philosopher",emoji:"🧠",color:"#64e8ff",provider:"anthropic"},
{name:"Grok",role:"The Maverick",emoji:"🚀",color:"#ff7283",provider:"xai"},
{name:"Duck",role:"The Speedster",emoji:"🦆",color:"#ffd166",provider:"duck"}];
const fallback={ChatGPT:["unsafe","unsure","unfair"],Gemini:["unsure","unsafe","unclear"],Claude:["untrue","unsafe","unclear"],Grok:["unfair","unsafe","unsure"],Duck:["unclear","unsafe","unfair"]};
const modes=[
["⌨️","Autocorrect Championship","Recover the intended word from a mangled real-world message."],
["🔤","Hangman","Solve the word before the referee runs out of letters."],["🎬","Guess the Movie","Clues, quotes and plot fragments."],
["🎵","Guess the Song","Identify a song from non-lyrical clues."],["🕵️","Mystery Object","Infer the object from progressively stronger clues."],
["🧩","Pattern Recognition","Sequences, transformations and hidden rules."],["🖼️","Image Guessing","Compete on visual interpretation challenges."],
["🧠","Logic Puzzles","Reasoning battles with one defensible solution."],["💻","Programming Battles","Compete on code reasoning and debugging."],
["🌎","General Knowledge","Classic rapid-fire trivia."],["🎭","Impersonation","Style challenges scored by the referee."],
["✨","Custom Challenge","You write the rules; the tournament engine runs them."]];
const library=[
["NotnunsFe it autocorrected","unsafe","A word meaning dangerous or not safe"],
["I left my phone in the frudge","fridge","A kitchen appliance"],
["Can you meat me outside?","meet","A verb meaning to get together"],
["The whether is awful today","weather","Something you check before going outside"],
["Turn the lites off please","lights","Things that illuminate a room"]];
let state=JSON.parse(localStorage.getItem("ait-state")||"null")||{round:1,guesses:0,hits:0,fast:"—",scores:{}};
C.forEach(c=>state.scores[c.name]??={pts:0,wins:0,attempts:0,hits:0});let running=false,currentMode="Autocorrect Championship";
const $=x=>document.getElementById(x),sleep=n=>new Promise(r=>setTimeout(r,n));function save(){localStorage.setItem("ait-state",JSON.stringify(state))}
function renderBots(){$("contestants").innerHTML=C.map(c=>`<article class="card bot" style="--accent:${c.color}" data-name="${c.name}"><div class="botHead"><div class="avatar">${c.emoji}</div><div><div class="botName">${c.name}</div><div class="role">${c.role}</div></div><div class="score">${state.scores[c.name].pts}</div></div><div class="answerBox">Waiting backstage.</div><span class="badge">READY</span></article>`).join("")}
function renderModes(){$("modes").innerHTML=modes.map(m=>`<div class="mode"><h3>${m[0]} ${m[1]}</h3><p>${m[2]}</p><button onclick="chooseMode('${m[1].replaceAll("'","\\'")}')">Choose mode</button></div>`).join("")}
function renderLibrary(){$("challengeCards").innerHTML=library.map((x,i)=>`<div class="mode"><h3>Challenge ${i+1}</h3><p>${x[0]}</p><button onclick="loadChallenge(${i})">Load into arena</button></div>`).join("")}
function standings(){$("standingsBody").innerHTML=[...C].sort((a,b)=>state.scores[b.name].pts-state.scores[a.name].pts).map(c=>{let s=state.scores[c.name],acc=s.attempts?Math.round(s.hits/s.attempts*100):0;return `<tr><td>${c.emoji} <b>${c.name}</b></td><td>${s.pts}</td><td>${s.wins}</td><td>${acc}%</td></tr>`}).join("");let l=[...C].sort((a,b)=>state.scores[b.name].pts-state.scores[a.name].pts)[0];$("leader").textContent=state.scores[l.name].pts?l.name:"—"}
function stats(){$("round").textContent="ROUND "+state.round;$("roundStat").textContent=state.round;$("guessStat").textContent=state.guesses;$("hitStat").textContent=state.hits;$("fastStat").textContent=state.fast;standings();save()}
function log(t){let d=document.createElement("div");d.className="log";d.textContent=t;$("log").prepend(d)}
function botState(el,text,kind=""){el.querySelector(".answerBox").innerHTML=text;let b=el.querySelector(".badge");b.className="badge "+kind;b.textContent=kind==="good"?"✓ CORRECT":kind==="bad"?"✕ MISS":"THINKING"}
function tone(f=500){if(!$("sound").checked)return;try{let a=new(window.AudioContext||window.webkitAudioContext),o=a.createOscillator(),g=a.createGain();o.frequency.value=f;g.gain.value=.04;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.1)}catch{}}
function celebrate(){if(!$("confettiOn").checked)return;for(let i=0;i<60;i++){let p=document.createElement("i");p.className="conf";p.style.left=Math.random()*100+"%";p.style.background=["#ffd166","#68e8ad","#6ba8ff","#b58cff","#ff7283"][i%5];p.style.animationDelay=Math.random()*.4+"s";$("confetti").appendChild(p);setTimeout(()=>p.remove(),3000)}}
async function askReal(c,challenge,hint,used){let r=await fetch("/api/contestant",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({provider:c.provider,name:c.name,mode:currentMode,challenge,hint,used})});if(!r.ok)throw new Error("connector unavailable");let j=await r.json();return (j.guess||"").trim().toLowerCase()}
async function run(){
if(running)return;running=true;$("start").disabled=true;let challenge=$("challenge").value.trim(),target=$("answer").value.trim().toLowerCase(),hint=$("hint").value.trim(),tries=+$("tries").value,pace=+$("pace").value,points=+$("points").value,used=new Set(),winner=null,startTime=performance.now();
$("refText").innerHTML=`🎙️ <b>Round ${state.round}!</b><br>${currentMode}<br><br>“${challenge}”`;log(`Round ${state.round}: ${challenge}`);
let bots=[...document.querySelectorAll(".bot")];bots.forEach(b=>botState(b,'<span class="dots"><i></i><i></i><i></i></span>'));
outer:for(let t=0;t<tries;t++){for(let i=0;i<C.length;i++){await sleep(pace);let c=C[i],guess;try{guess=$("realAI").checked?await askReal(c,challenge,hint,[...used]):fallback[c.name][t%fallback[c.name].length]}catch{guess=fallback[c.name][t%fallback[c.name].length]}
guess=guess.toLowerCase();state.guesses++;state.scores[c.name].attempts++;
if($("dupes").checked&&used.has(guess)){botState(bots[i],`Guess ${t+1}: <b>${guess}</b><br><small>Referee: duplicate rejected.</small>`,"bad");log(`${c.name}: ${guess} — duplicate rejected.`);tone(180);continue}
used.add(guess);if(guess===target){let secs=((performance.now()-startTime)/1000).toFixed(1);winner=c;state.hits++;state.fast=secs+"s";state.scores[c.name].pts+=points;state.scores[c.name].wins++;state.scores[c.name].hits++;botState(bots[i],`Guess ${t+1}: <b>${guess}</b><br>⚡ ${secs}s`,"good");log(`${c.name} WINS with “${guess}” in ${secs}s!`);tone(800);break outer}else{botState(bots[i],`Guess ${t+1}: <b>${guess}</b>`,"bad");log(`${c.name}: “${guess}” — wrong.`);tone(220)}}}
if(winner){$("refText").innerHTML=`🏆 <b>${winner.name} WINS!</b><br><br>“${target}” is correct.<br>+${points} points to ${winner.name}.`;celebrate()}else $("refText").innerHTML=`❌ No winner this round.<br><br>The answer was <b>${target}</b>.`;
renderBots();stats();running=false;$("start").disabled=false}
function chooseMode(m){currentMode=m;$("eventTitle").textContent="🎮 "+m;$("modeTicker").textContent=m.toUpperCase();document.querySelector('[data-tab="arena"]').click();$("refText").innerHTML=`🎤 ${m} selected. Load a challenge and start the round.`}
function loadChallenge(i){let x=library[i];$("challenge").value=x[0];$("answer").value=x[1];$("hint").value=x[2];chooseMode("Autocorrect Championship")}
window.chooseMode=chooseMode;window.loadChallenge=loadChallenge;
document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#tabs button,.tab").forEach(x=>x.classList.remove("on"));b.classList.add("on");$(b.dataset.tab).classList.add("on");if(b.dataset.tab==="standings")standings()});
$("start").onclick=run;$("hintBtn").onclick=()=>{$("refText").innerHTML="💡 <b>HINT:</b><br>"+$("hint").value;log("The referee revealed a hint.")};
$("next").onclick=()=>{state.round++;stats();$("refText").innerHTML=`🎤 Round ${state.round} is ready. New challenge, same arena.`;renderBots()};
$("reset").onclick=()=>{if(!confirm("Reset tournament scores and history?"))return;localStorage.removeItem("ait-state");location.reload()};
$("clearLog").onclick=()=>{$("log").innerHTML=""};
renderBots();renderModes();renderLibrary();stats();
fetch("/api/status").then(r=>r.json()).then(j=>$("apiStatus").textContent=j.configured?.length?j.configured.join(", ")+" configured":"No private API keys configured yet — simulation mode is ready.").catch(()=>$("apiStatus").textContent="Simulation mode ready.");

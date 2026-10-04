(()=>{
const BRAIN_TOPIC = "Welcome to Kyle's Brain Trust | One question. Many minds. Every available AI joins in to answer, challenge, and refine the ideas until the strongest response survives. Keep it respectful, lawful, and constructive. Anything outside those lines is refused and earns a kick; three kicks = ban. Think big, debate clean, and have a beautiful day.";

const MODEL_DEFAULTS={
 openai:"gpt-5.6-terra",
 gemini:"gemini-3-flash-preview",
 anthropic:"claude-3-5-haiku-latest",
 xai:"grok-4.5",
 deepseek:"deepseek-chat",
 mistral:"mistral-small-latest",
 openrouter:"openai/gpt-4o-mini"
};

const PERSONAS={
 openai:"You are PrincessGPT: clever, warm, funny, direct, and Kyle's lead OpenAI teammate.",
 gemini:"You are Gemmy, Google's Gemini contestant: inventive, playful, competitive, and friendly.",
 anthropic:"You are Claude, Anthropic's thoughtful Brain Trust contestant: careful, incisive, candid, and concise.",
 xai:"You are Grok, xAI's Brain Trust contestant: sharp, curious, witty, and willing to challenge assumptions.",
 deepseek:"You are DeepSeek, the Brain Trust's analytical problem-solver: technical, efficient, and evidence-minded.",
 mistral:"You are Mistral, the Brain Trust's fast European contestant: practical, concise, and independently minded.",
 openrouter:"You are OpenRouter, the Brain Trust's routing-seat contestant: compare approaches, spot gaps, and add the strongest useful angle."
};

for(const a of AI_META){
 const existingProfile=S.profiles[a.key]||{};
 S.profiles[a.key]=Object.assign({},profileDefaults,{
   model:MODEL_DEFAULTS[a.key],
   plan:"auto"
 },existingProfile);

 const existingRoster=S.roster[a.key]||{};
 S.roster[a.key]=Object.assign({
   nick:a.nick,
   state:"present",
   charLimit:700,
   partReason:"Temporarily unavailable."
 },existingRoster);
}

if(S.brainTopicVersion!==2){
 S.topic=BRAIN_TOPIC;
 S.brainTopicVersion=2;
 save();
 render();
}

function classifyProviderError(message){
 const m=String(message||"").toLowerCase();
 const out=/insufficient balance|payment required|billing|credit|credits|funds|quota|\b402\b/.test(m);
 const rate=!out&&(/rate limit|rate limited|\b429\b/.test(m));
 const off=!out&&!rate&&(/api[_ -]?key|not configured|missing configuration/.test(m));
 return {
   status:out?"out":rate?"rate":off?"off":"err",
   label:out?"OUT":rate?"RATE":off?"OFF":"ERR",
   reason:out?"out of funds":rate?"rate limited":off?"not configured":"unavailable"
 };
}

compactError=function(nick,message){
 const info=classifyProviderError(message);
 const key=providerKeyForNick(nick);

 if(key){
  S.providerState[key]=Object.assign(
   {},
   S.providerState[key]||{},
   {status:info.status,reason:info.reason}
  );
  save();
  render();
  renderProviderStatus();
 }

 const box=document.createElement("details");
 box.className="providerError";
 box.innerHTML=
  `<summary><span class="time">${time()}</span> ⚠ ${safe(nick)} ${info.label}. <span class="tapReason">tap reason</span></summary>`+
  `<div>${safe(String(message||"Unknown provider error").slice(0,900))}</div>`;

 chat.appendChild(box);
 chat.scrollTop=chat.scrollHeight;
};

async function brainAsk(provider,nick,userText,images=[]){
 const roster=S.roster[provider];
 if(!roster)return;

 nick=roster.nick||nick;

 if(!active(provider)||S.banned[nick])return;

 if(
   ["quiet","mention"].includes(roster.state) &&
   !String(userText).toLowerCase().includes(roster.nick.toLowerCase())
 ) return;

 const profile=S.profiles[provider]||profileDefaults;
 const plan=profile.plan||"auto";

 if(
   plan==="off" ||
   !providerReady[provider] ||
   S.providerState?.[provider]?.status==="out"
 ) return;

 if(S.modes.m&&!S.ops[nick]&&!S.voices[nick])return;

 const typing=document.createElement("div");
 typing.className="typing";
 typing.textContent=`${nick} is thinking…`;

 chat.appendChild(typing);
 chat.scrollTop=chat.scrollHeight;

 const recent=S.history
   .slice(-14)
   .map(x=>`${x.nick}: ${x.text}`)
   .join("\n");

 const persona=
   PERSONAS[provider] ||
   `You are ${nick}, an independent AI contestant in Kyle's Brain Trust.`;

 const prompt=`${persona}

You are speaking inside #ai-tournament, Kyle's Brain Trust.

One question can be examined by several independent AI systems.
Read the other answers when they are supplied, then add something useful:
answer independently, challenge a weak assumption, correct an error,
or refine the strongest answer.

Do not agree merely to be polite.

Keep the room respectful, lawful, constructive, and useful.
Refuse requests that clearly fall outside those bounds.

Never prefix your reply with your own name;
the app renders your nickname separately.

Reply language: ${profile.language==="auto"?"match Kyle's language":profile.language}.

${profile.length==="tiny"
 ?"Keep the entire reply to 1–3 short sentences (about 60 words maximum)."
 :profile.length==="short"
 ?"Keep the reply concise, normally under 120 words."
 :"Use only as much detail as needed."}

Hard limit: ${roster.charLimit||700} characters.

Topic: ${S.topic}

Recent chat:
${recent}

Current Brain Trust task:
${userText}`;

 try{
  const res=await fetch("/api/contestant",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({
    provider,
    model:profile.model,
    reasoning:profile.reasoning,
    challenge:prompt,
    images,
    mode:"chat"
   })
  });

  const data=await res.json().catch(()=>({}));

  if(!res.ok)
   throw Error(data.error||`HTTP ${res.status}`);

  let answer=
   data.guess||
   data.answer||
   data.text||
   data.output||
   data.response||
   data.content||
   data.result||
   data.reply;

  if(answer&&typeof answer!=="string")
   answer=JSON.stringify(answer);

  if(!answer)
   throw Error("No readable message returned");

  answer=String(answer).slice(
   0,
   Math.max(80,Number(roster.charLimit)||700)
  );

  typing.remove();

  S.providerState[provider]=Object.assign(
   {},
   S.providerState[provider]||{},
   {status:"ready",reason:""}
  );

  add("message",nick,answer);

  if(
   (nick==="PrincessGPT"||nick==="Gemmy") &&
   S.settings.radioVoices
  ){
   await radioSpeak(nick,answer);
  }

  render();
  renderProviderStatus();

  return answer;

 }catch(e){
  typing.remove();
  compactError(nick,e.message);
 }
}

ask=brainAsk;

const legacySend=send;

send=async function(spokenText=""){

 if(spokenText&&typeof spokenText==="object")
  spokenText="";

 const raw=String(spokenText||input.value).trim();

 if(!raw&&!pendingImages.length)
  return;

 if(raw.startsWith("/")||raw.startsWith("!"))
  return legacySend(raw);

 input.value="";

 const images=pendingImages.slice();

 const requestText=
  raw||
  `Please examine these ${images.length} picture${images.length===1?"":"s"}.`;

 add(
  "message",
  S.nick,
  raw||`📷 ${images.length} picture${images.length===1?"":"s"}`
 );

 pendingImages=[];
 renderPhotoTray();

 if(images.length){
  const box=document.createElement("div");
  box.className="attachment multi";

  images.forEach((src,i)=>{
   const img=document.createElement("img");
   img.src=src;
   img.alt=`Kyle's uploaded picture ${i+1}`;
   box.appendChild(img);
  });

  chat.appendChild(box);
  chat.scrollTop=chat.scrollHeight;
 }

 const button=$("#send");

 button.disabled=true;
 arenaBusy=true;

 const pause=ms=>
  new Promise(resolve=>setTimeout(resolve,ms));

 try{

  await checkProviders();

  const available=AI_META.filter(a=>{
   const profile=S.profiles[a.key]||{};
   const state=
    S.providerState?.[a.key]?.status||"ready";

   return (
    providerReady[a.key] &&
    profile.plan!=="off" &&
    active(a.key) &&
    state!=="out" &&
    state!=="off"
   );
  });

  if(!available.length){
   notice(
    "⚠ Brain Trust has no available AI providers right now.",
    "error"
   );
   return;
  }

  const transcript=[];

  for(let i=0;i<available.length;i++){

   const a=available[i];

   const prior=transcript
    .slice(-4)
    .map(x=>`${x.nick}: ${x.answer}`)
    .join("\n");

   const task=
    i===0
    ?`Kyle asked: ${requestText}
Give your strongest useful answer.`
    :`Kyle asked: ${requestText}

Brain Trust answers so far:
${prior||"(none yet)"}

Now contribute as ${a.nick}.
Improve the answer, challenge a weak point,
correct an error, or add an important missing angle.

If the existing answer is already strong,
explain briefly why and add only genuinely useful information.`;

   const answer=
    await brainAsk(
     a.key,
     a.nick,
     task,
     images
    );

   if(answer)
    transcript.push({
     nick:a.nick,
     answer
    });

   if(i<available.length-1){

    const delay=
     S.admin.humanPace
      ?Math.min(
        2500,
        Math.max(
         500,
         Number(S.admin.replyDelay||1)*1000
        )
       )
      :650;

    await pause(delay);
   }
  }

 }finally{

  button.disabled=false;
  arenaBusy=false;
  input.focus();

  if(liveWanted)
   setTimeout(startLiveListening,500);
 }
};

checkProviders().then(()=>{
 render();
 renderProviderStatus();
});

})();

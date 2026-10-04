(()=>{
  let ctx=null;
  let unlocked=false;
  let playing=null;
  let unlockBtn=null;

  function context(){
    if(!ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)throw Error("Web Audio is not supported by this browser");
      ctx=new AC();
    }
    return ctx;
  }

  function bytesFromBase64(b64){
    const raw=atob(b64);
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return bytes;
  }

  function stopPlaying(){
    if(playing){
      try{playing.stop()}catch{}
      playing=null;
    }
  }

  async function unlockVoices(showNotice=true){
    try{
      const ac=context();
      await ac.resume();

      // Start one silent frame while we are still inside the user's gesture.
      const silent=ac.createBuffer(1,1,22050);
      const src=ac.createBufferSource();
      src.buffer=silent;
      src.connect(ac.destination);
      src.start(0);

      unlocked=ac.state==="running";
      sessionStorage.setItem("arenaVoiceUnlocked",unlocked?"1":"0");

      if(unlockBtn){
        unlockBtn.textContent=unlocked?"🔊 VOICES ON":"🔇 ENABLE VOICES";
        unlockBtn.classList.toggle("enabled",unlocked);
      }

      if(showNotice && typeof notice==="function"){
        notice(
          unlocked
            ?"🔊 AI voices enabled for this browser session."
            :"⚠ Tap ENABLE VOICES again; the browser has not released audio yet.",
          unlocked?"system":"error"
        );
      }
      return unlocked;
    }catch(e){
      if(typeof notice==="function")
        notice(`🔊 Voice unlock error: ${e.message}`,"error");
      return false;
    }
  }

  async function speakThroughWebAudio(nick,text,audition=false){
    const provider=nick==="PrincessGPT"?"openai":nick==="Gemmy"?"gemini":"";
    if(!provider)return;

    if(!unlocked){
      if(typeof notice==="function")
        notice(`🔇 Tap ENABLE VOICES once before ${nick} can speak automatically.`,"error");
      return;
    }

    try{
      const ac=context();
      if(ac.state!=="running")await ac.resume();
      if(ac.state!=="running")throw Error("browser audio is still locked");

      const r=await fetch("/api/speak",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({provider,text:String(text||"").slice(0,4000)})
      });

      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(data.error||`voice HTTP ${r.status}`);
      if(!data.audio)throw Error("voice API returned no audio");

      const bytes=bytesFromBase64(data.audio);
      const arrayBuffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
      const audioBuffer=await ac.decodeAudioData(arrayBuffer);

      stopPlaying();

      await new Promise((resolve,reject)=>{
        try{
          const src=ac.createBufferSource();
          playing=src;
          src.buffer=audioBuffer;
          src.connect(ac.destination);
          src.onended=()=>{
            if(playing===src)playing=null;
            resolve();
          };
          src.start(0);
        }catch(e){
          reject(e);
        }
      });

    }catch(e){
      if(typeof notice==="function")
        notice(`📻 ${nick} voice error: ${e.message}`,"error");
    }
  }

  // Replace the app's HTMLAudio playback with WebAudio.
  // A once-unlocked AudioContext avoids Safari's later autoplay rejection.
  if(typeof radioSpeak==="function"){
    radioSpeak=speakThroughWebAudio;
  }else{
    window.radioSpeak=speakThroughWebAudio;
  }

  function installUnlockButton(){
    if(document.getElementById("voiceUnlockBtn"))return;

    unlockBtn=document.createElement("button");
    unlockBtn.id="voiceUnlockBtn";
    unlockBtn.type="button";
    unlockBtn.textContent="🔇 ENABLE VOICES";
    unlockBtn.title="Tap once so Safari/iPhone can play AI voices automatically";
    unlockBtn.onclick=()=>unlockVoices(true);

    const auditions=document.querySelector(".voiceAuditions");
    if(auditions){
      auditions.parentNode.insertBefore(unlockBtn,auditions);
    }else{
      const settings=document.querySelector("#settings");
      if(settings)settings.appendChild(unlockBtn);
    }

    // Also add a small one-time prompt in the room so it is hard to miss.
    if(!sessionStorage.getItem("arenaVoicePromptShown")){
      const chat=document.querySelector("#chat");
      if(chat){
        const box=document.createElement("div");
        box.className="voiceUnlockPrompt";
        box.innerHTML='<button type="button">🔊 Tap once to enable PrincessGPT + Gemmy voices</button>';
        box.querySelector("button").onclick=async()=>{
          const ok=await unlockVoices(true);
          if(ok)box.remove();
        };
        chat.insertBefore(box,chat.firstChild);
      }
      sessionStorage.setItem("arenaVoicePromptShown","1");
    }
  }

  installUnlockButton();

  // If the user manually taps either speaker icon, that gesture can unlock
  // the context immediately before the normal handler runs.
  document.addEventListener("pointerdown",e=>{
    if(e.target.closest(".speakOne") && !unlocked){
      unlockVoices(false);
    }
  },{capture:true,passive:true});

  // Re-render state if Safari suspends/resumes the audio context.
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden && ctx && ctx.state==="suspended"){
      // Do not force playback; next deliberate tap can resume if Safari requires it.
      unlocked=false;
      if(unlockBtn){
        unlockBtn.textContent="🔇 ENABLE VOICES";
        unlockBtn.classList.remove("enabled");
      }
    }
  });
})();

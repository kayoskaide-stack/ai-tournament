(()=>{
  const start=document.querySelector("#start"),box=document.querySelector("#challenge"),command=document.querySelector("#command"),copy=document.querySelector("#copy"),status=document.querySelector("#status");
  let challenge="",timer=null;
  const say=(text,kind="")=>{status.className=kind;status.textContent=text};
  async function json(url,options={}){const r=await fetch(url,{cache:"no-store",...options}),data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||`HTTP ${r.status}`);return data}
  async function poll(){if(!challenge)return;try{const d=await json(`/api/cservice?action=status&challenge=${encodeURIComponent(challenge)}`);if(d.verified){clearInterval(timer);say(`Verified as ${d.username}. Opening Brain Trust…`,"ok");setTimeout(()=>location.assign(d.redirect||"/"),700);return}say(d.message||"Waiting for X…",d.status==="not_logged_in"?"bad":"")}catch(e){clearInterval(timer);say(e.message||String(e),"bad");start.disabled=false}}
  start.onclick=async()=>{start.disabled=true;say("Creating a one-time CService check…");try{const d=await json("/api/cservice?action=challenge",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});challenge=d.challenge;command.textContent=d.command;box.hidden=false;say("Ready. Paste the command in #ai-tournament after you are logged into X.");timer=setInterval(poll,2500);poll()}catch(e){say(e.message||String(e),"bad");start.disabled=false}};
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(command.textContent);copy.textContent="COPIED ✓"}catch{copy.textContent="SELECT + COPY ABOVE"}};
})();

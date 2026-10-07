
(()=>{
  function ensure(){
    let box=document.querySelector("#btBuildConsole");if(box)return box;
    box=document.createElement("section");box.id="btBuildConsole";box.hidden=true;
    box.innerHTML=`<div class="btBuildHead"><b>PRIVATE BUILD CONSOLE</b><button id="btBuildClose">×</button></div><div id="btBuildBar"><i></i></div><pre id="btBuildLog"></pre>`;
    document.body.appendChild(box);box.querySelector("#btBuildClose").onclick=()=>box.hidden=true;return box;
  }
  function line(box,text){const log=box.querySelector("#btBuildLog");log.textContent+=`[${new Date().toLocaleTimeString()}] ${text}\n`;log.scrollTop=log.scrollHeight}
  async function pilotStatus(pr){
    const r=await fetch("/api/gate?target=autopilot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"status",pr})});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d;
  }
  async function follow(meta){
    const pr=Number(meta?.pr||meta);if(!pr)throw Error("Build console needs a preview PR number.");
    const box=ensure(),bar=box.querySelector("#btBuildBar i");box.hidden=false;line(box,`PR #${pr} created. Production unchanged.`);bar.style.width="25%";
    let last="",rounds=0;
    while(rounds++<150){
      const d=await pilotStatus(pr),checks=(d.checks||[]).map(x=>`${x.name}: ${x.status}/${x.conclusion||"pending"}`).join(" · "),msg=`GitHub ${d.combinedState||"pending"}${checks?` · ${checks}`:""}`;
      if(msg!==last){line(box,msg);last=msg}
      if(d.ready){bar.style.width="100%";line(box,"✅ Preview checks passed. Ready for Kyle's approval.");return d}
      if(["failure","error"].includes(String(d.combinedState||"").toLowerCase())){bar.style.width="100%";line(box,"🛑 Preview failed. Production remains unchanged.");return d}
      bar.style.width=`${Math.min(90,30+rounds)}%`;await new Promise(r=>setTimeout(r,4000));
    }
    line(box,"⏳ Console stopped polling after 10 minutes. Use CHECK to refresh.");
  }
  window.BrainTrustBuildConsole={follow,open:()=>{ensure().hidden=false}};
})();

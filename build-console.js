(()=>{
  function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
  function ensure(){
    let box=document.querySelector("#btBuildConsole");
    if(box) return box;
    box=document.createElement("section");
    box.id="btBuildConsole";
    box.hidden=true;
    box.innerHTML=`<div class="btBuildHead"><b>PRIVATE BUILD CONSOLE</b><button id="btBuildClose">×</button></div><div id="btBuildBar"><i></i></div><pre id="btBuildLog"></pre>`;
    document.body.appendChild(box);
    box.querySelector("#btBuildClose").onclick=()=>box.hidden=true;
    return box;
  }
  async function follow(id){
    const box=ensure(),log=box.querySelector("#btBuildLog"),bar=box.querySelector("#btBuildBar i");
    box.hidden=false; let since=0,done=false;
    while(!done){
      try{
        const r=await fetch(`/api/build/events?id=${encodeURIComponent(id)}&since=${since}`,{cache:"no-store"});
        const d=await r.json();
        for(const e of d.events||[]){
          since=Math.max(since,Number(e.at||0));
          if(e.progress!=null) bar.style.width=Math.max(0,Math.min(100,Number(e.progress)))+"%";
          log.textContent += `[${new Date(e.at).toLocaleTimeString()}] ${e.message||e.type||""}\n`;
          log.scrollTop=log.scrollHeight;
          if(e.type==="done"||e.type==="error") done=true;
        }
      }catch(e){log.textContent+=`console error: ${e.message}\n`}
      if(!done) await new Promise(r=>setTimeout(r,1200));
    }
  }
  window.BrainTrustBuildConsole={follow,open:()=>{ensure().hidden=false}};
})();


(()=>{
  const state={target:"channel",privateNick:""};
  async function request(target,{method="GET",body}={}){
    const r=await fetch(`/api/gate?target=${encodeURIComponent(target)}`,{method,headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,cache:"no-store"});
    const t=await r.text();let d={};try{d=t?JSON.parse(t):{}}catch{d={raw:t}}if(!r.ok)throw Error(d.error||t||`HTTP ${r.status}`);return d;
  }
  window.BrainTrustIRC={
    setPrivateNick(nick){state.privateNick=String(nick||"").trim();state.target=state.privateNick?"private":"channel";window.dispatchEvent(new CustomEvent("braintrust:irc-target",{detail:{...state}}))},
    pm(nick,text){return request("irc-pm",{method:"POST",body:{nick,text}})},
    status(){return request("irc-status")},
    capabilities(){return request("capabilities")},
    tool(name,args=[]){return request("relay-tool",{method:"POST",body:{name,args}})},
    dcc(nick,filePath){return request("relay-dcc",{method:"POST",body:{nick,filePath}})},
    state
  };
})();

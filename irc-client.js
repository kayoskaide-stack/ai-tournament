(()=>{
  const state={target:"channel",privateNick:""};
  function dispatch(name,detail){window.dispatchEvent(new CustomEvent(name,{detail}))}
  async function api(url,body){
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const t=await r.text(); if(!r.ok) throw Error(t); return t;
  }
  window.BrainTrustIRC={
    setPrivateNick(nick){state.privateNick=String(nick||"").trim();state.target=state.privateNick?"private":"channel";dispatch("braintrust:irc-target",state)},
    async pm(nick,text){return api("/api/irc/private-message",{nick,text})},
    async status(){const r=await fetch("/api/irc/status",{cache:"no-store"});return r.json()},
    async capabilities(){const r=await fetch("/api/braintrust-capabilities",{cache:"no-store"});return r.json()},
    state
  };
})();

(()=>{
  const APP_SCRIPTS=["/app.js","/braintrust-v2.js","/mobile-hotfix.js","/adaptive-display.js","/voice-unlock.js","/gemini-free-max.js","/free-life-ui.js","/control-plane.js","/cube-tabs.js","/channel-log.js","/free-power-ui.js","/usrctrl.js"];
  function el(tag,attrs={},text=""){const node=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==="class")node.className=v;else node.setAttribute(k,v)}if(text)node.textContent=text;return node}
  function installStyle(){if(document.getElementById("bt-auth-style"))return;const style=el("style",{id:"bt-auth-style"});style.textContent=`
body.bt-auth-pending .app,body.bt-auth-pending #layoutDock,body.bt-auth-pending #layoutPanel{visibility:hidden}
#btAuthGate{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#071019;color:#d9e3ea;padding:18px;font-family:Menlo,Monaco,Consolas,monospace}
#btAuthCard{width:min(420px,94vw);border:1px solid #35516b;border-radius:12px;background:#0b151f;padding:18px;box-shadow:0 18px 80px #000a}
#btAuthCard h1{margin:0 0 5px;font-size:20px;color:#f0c85b}#btAuthCard p{font-size:11px;line-height:1.5;color:#8fa4b5}
#btAuthCard label{display:block;margin:12px 0 5px;font-size:10px;color:#a9bac7}
#btAuthCard input{box-sizing:border-box;width:100%;min-height:42px;background:#050b10;color:#e7edf2;border:1px solid #3b5872;border-radius:8px;padding:9px;font:14px Menlo,monospace}
#btAuthCard button{width:100%;min-height:44px;margin-top:14px;border:1px solid #4b7395;border-radius:8px;background:#163a58;color:white;font-weight:800}#btMagic{background:#10283b!important;color:#bfe1ff!important}
#btAuthError{min-height:18px;color:#ff7887;margin-top:9px;font-size:10px}
#btSessionBadge{display:inline-flex;align-items:center;margin-left:5px;padding:1px 5px;border:1px solid #3b5872;border-radius:8px;font:700 7px Menlo,monospace;color:#9bc9ee}
#btLogout{margin-left:4px;background:transparent;border:1px solid #3b5872;color:#9fb3c3;border-radius:6px;padding:2px 5px;font:700 7px Menlo,monospace}
body.bt-role-member .fundMini{display:none!important}`;document.head.appendChild(style)}
  function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src+(src.includes("?")?"&":"?")+"v=20261016-usrctrl";s.onload=resolve;s.onerror=()=>reject(new Error(`Could not load ${src}`));document.body.appendChild(s)})}
  function seedNick(user){try{const raw=localStorage.getItem("AITirc");if(!raw)return;const state=JSON.parse(raw);if(!state||typeof state!=="object")return;state.nick=user.nick;state.ops={};if(["owner","maintainer"].includes(user.role))state.ops[user.nick]=1;localStorage.setItem("AITirc",JSON.stringify(state))}catch{}}
  async function loadApp(user){window.BRAINTRUST_USER=user;seedNick(user);for(const src of APP_SCRIPTS)await loadScript(src);if(typeof S!=="undefined"){S.nick=user.nick;S.ops={};if(["owner","maintainer"].includes(user.role))S.ops[user.nick]=1;if(typeof save==="function")save();if(typeof render==="function")render()}document.body.classList.add(`bt-role-${user.role}`);const badge=document.querySelector("#deviceBadge");if(badge){const role=el("span",{id:"btSessionBadge"},user.role.toUpperCase());badge.insertAdjacentElement("afterend",role);const out=el("button",{id:"btLogout",type:"button"},"LOGOUT");out.onclick=async()=>{try{await fetch("/api/logout",{method:"POST"})}catch{}location.reload()};role.insertAdjacentElement("afterend",out)}document.body.classList.remove("bt-auth-pending");document.body.classList.add("bt-auth-ready")}
  function showLogin(message=""){
    document.body.classList.add("bt-auth-pending");document.querySelector("#btAuthGate")?.remove();
    const gate=el("section",{id:"btAuthGate"}),card=el("form",{id:"btAuthCard"});
    card.innerHTML=`<h1>Kyle's Brain Trust</h1><p>Private room. Guests must complete: invite code → confirm email → verify CService/X.</p><label for="btNick">Nickname</label><input id="btNick" autocomplete="username" autocapitalize="none" spellcheck="false"><label for="btCode">Access code</label><input id="btCode" type="password" autocomplete="current-password"><button type="submit">CONTINUE WITH INVITE CODE</button><hr style="border:0;border-top:1px solid #23394b;margin:16px 0"><label for="btEmail">Your email</label><input id="btEmail" type="email" autocomplete="email" autocapitalize="none"><button id="btMagic" type="button">CONFIRM EMAIL</button><div id="btAuthError"></div>`;
    gate.appendChild(card);document.body.appendChild(gate);const error=card.querySelector("#btAuthError");error.textContent=message;
    card.addEventListener("submit",async e=>{e.preventDefault();const button=card.querySelector('button[type="submit"]');error.textContent="";button.disabled=true;button.textContent="CHECKING…";try{const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nick:card.querySelector("#btNick").value,code:card.querySelector("#btCode").value})}),data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||`HTTP ${r.status}`);location.reload()}catch(err){error.textContent=err.message||String(err);button.disabled=false;button.textContent="CONTINUE WITH INVITE CODE"}});
    card.querySelector("#btMagic").onclick=async()=>{const button=card.querySelector("#btMagic");error.textContent="";button.disabled=true;button.textContent="SENDING…";try{const r=await fetch("/api/auth?action=request-link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:card.querySelector("#btEmail").value,nick:card.querySelector("#btNick").value})}),data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||`HTTP ${r.status}`);error.style.color="#8de6a8";error.textContent=data.message||"If authorized, a sign-in link was sent."}catch(err){error.style.color="#ff7887";error.textContent=err.message||String(err)}finally{button.disabled=false;button.textContent="CONFIRM EMAIL"}};
  }
  async function showOnboarding(state) {
    showLogin();
    const card = document.querySelector("#btAuthCard");
    const status = card.querySelector("#btAuthError");
    card.querySelector("h1").textContent = "Finish registration";
    card.querySelector("p").textContent = state.emailVerified
      ? "Email confirmed. Verify your CService/X account to unlock chat."
      : "Invite accepted. Confirm your email first; then verify CService/X.";
    for (const id of ["btNick", "btCode"]) {
      const input = card.querySelector("#" + id);
      card.querySelector(`label[for="${id}"]`).hidden = true;
      input.hidden = true;
    }
    card.querySelector('button[type="submit"]').hidden = true;
    const restart = el("button", { type: "button" }, "START OVER / DIFFERENT ACCOUNT");
    restart.onclick = async () => { await fetch("/api/logout", { method: "POST" }); location.reload(); };
    card.appendChild(restart);
    if (!state.emailVerified) return;
    for (const selector of ['label[for="btEmail"]', '#btEmail', '#btMagic']) card.querySelector(selector).hidden = true;
    const instructions = el("p");
    instructions.append("1. Register and confirm your account at ");
    const link = el("a", { href: "https://cservice.undernet.org/", target: "_blank", rel: "noopener" }, "Undernet CService");
    instructions.append(link, ". 2. Connect to Undernet using an IRC client and log in to X there. 3. Paste the private command below. Your X password stays in your IRC client.");
    card.insertBefore(instructions, status);
    const command = el("pre", { style: "white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px" });
    card.insertBefore(command, status);
    const check = el("button", { type: "button" }, "CREATE VERIFICATION COMMAND");
    card.insertBefore(check, status);
    let challenge = "";
    check.onclick = async () => {
      check.disabled = true;
      try {
        const action = challenge ? "identity-status" : "identity-start";
        const response = await fetch("/api/auth?action=" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge }) });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Verification unavailable.");
        if (data.verified) { location.reload(); return; }
        if (data.challenge) {
          challenge = data.challenge;
          command.textContent = data.command;
          const copy = el("button", { type: "button" }, "COPY COMMAND");
          copy.onclick = async () => { try { await navigator.clipboard.writeText(command.textContent); copy.textContent = "COPIED"; } catch { status.textContent = "Select and copy the command above."; } };
          card.insertBefore(copy, check);
        }
        status.textContent = data.message || "Send this private command from your X-authenticated nickname, then check verification.";
        check.textContent = "CHECK VERIFICATION";
      } catch (e) { status.textContent = e.message; }
      finally { check.disabled = false; }
    };
  }
  async function boot(){installStyle();document.body.classList.add("bt-auth-pending");try{const r=await fetch("/api/session",{cache:"no-store"}),data=await r.json().catch(()=>({}));if(r.ok&&data.user){await loadApp(data.user);return}if(data.onboarding){await showOnboarding(data.onboarding);return}showLogin(data.frozen?"Brain Trust is in owner lockdown.":"")}catch(e){showLogin(`Authentication service error: ${e.message||e}`)}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot()
})();

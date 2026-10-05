(()=>{
  // === LATITUDE_GROK_UI_V1 ===
  const DAY=()=>new Date().toISOString().slice(0,10);
  const OR_LIMIT=45; // keep ~5 calls in reserve from the current 50/day free plan

  function state(){
    S.freeLife=S.freeLife||{
      day:DAY(),
      openrouterCalls:0,
      limit:OR_LIMIT
    };

    if(S.freeLife.day!==DAY()){
      S.freeLife.day=DAY();
      S.freeLife.openrouterCalls=0;
    }

    S.freeLife.limit=OR_LIMIT;
    return S.freeLife;
  }

  function migrate(){
    const fl=state();

    S.profiles=S.profiles||{};

    S.profiles.openrouter=Object.assign(
      {},
      S.profiles.openrouter||{},
      {model:"openrouter/free",plan:"auto"}
    );

    S.profiles.anthropic=Object.assign(
      {},
      S.profiles.anthropic||{},
      {model:"claude-haiku-4-5-20251001"}
    );

    S.profiles.xai=Object.assign(
      {},
      S.profiles.xai||{},
      {model:"grok-4.3"}
    );

    const xaiState=S.providerState?.xai;

    if(
      xaiState &&
      ["out","rate","err","off"].includes(
        xaiState.status
      )
    ){
      S.providerState.xai=
        Object.assign(
          {},
          xaiState,
          {
            status:"ready",
            reason:"Latitude route armed"
          }
        );
    }

    for(const key of ["deepseek","mistral","openrouter"]){
      const st=S.providerState?.[key];
      if(st && ["out","rate","err"].includes(st.status)){
        S.providerState[key]=Object.assign({},st,{
          status:"ready",
          reason:"FREE-LIFE armed"
        });
      }
    }

    S.freeLifeVersion=1;
    save();
    return fl;
  }

  window.freeLifeCanCall=function(provider){
    const fl=state();

    // Mistral is allowed even after the OR reserve because it first tries
    // Mistral's own Free-mode API.
    if(provider==="mistral")return true;

    if(!["deepseek","openrouter"].includes(provider))return true;

    if(fl.openrouterCalls>=fl.limit){
      const key=providerKeyForNick(
        provider==="deepseek"?"DeepSeek":"OpenRouter"
      );

      if(key){
        S.providerState[key]=Object.assign(
          {},
          S.providerState[key]||{},
          {
            status:"rate",
            reason:`free reserve reached (${fl.openrouterCalls}/${fl.limit})`
          }
        );
        save();
        render();
      }

      return false;
    }

    return true;
  };

  window.freeLifeRecord=function(provider,data){
    const fl=state();

    if(String(data?.route||"").startsWith("openrouter/")){
      fl.openrouterCalls++;
      save();
    }

    setTimeout(enhanceRoster,0);
  };

  function shortModel(model){
    let m=String(model||"");
    m=m.replace(/^deepseek\//,"");
    m=m.replace(/^mistralai\//,"");
    m=m.replace(/:free$/,"");
    m=m.replace(/^openrouter\//,"OR/");
    m=m.replace("claude-haiku-4-5-20251001","Haiku 4.5");
    m=m.replace("gemini-","Gem ");
    m=m.replace("deepseek-v4-flash-0731","V4 Flash");
    m=m.replace("deepseek-v4-flash","V4 Flash");
    m=m.replace("deepseek-chat-v3.1","V3.1");
    m=m.replace("mistral-nemo","Nemo");
    m=m.replace("mistral-7b-instruct","7B");
    m=m.replace("mistral-small-latest","Small");
    if(m.length>15)m=m.slice(0,14)+"…";
    return m;
  }

  function ensureBadge(row,text,kind,title){
    let badge=row.querySelector(".freeLifeBadge");
    if(!badge){
      badge=document.createElement("span");
      badge.className="aiState freeLifeBadge";
      const fund=row.querySelector(".fundMini");
      if(fund)row.insertBefore(badge,fund);
      else row.appendChild(badge);
    }
    badge.textContent=text;
    badge.className=`aiState freeLifeBadge ${kind}`;
    if(title)badge.title=title;
  }

  function enhanceRoster(){
    if(typeof AI_META==="undefined")return;

    const rows=[...document.querySelectorAll("#users .aiUser")];
    const fl=state();

    rows.forEach((row,i)=>{
      const a=AI_META[i];
      if(!a)return;
      const st=S.providerState?.[a.key]||{};
      const configured=S.profiles?.[a.key]?.model||"";
      const model=st.model||configured;

      let mini=row.querySelector(".modelMini");
      if(!mini){
        mini=document.createElement("span");
        mini.className="modelMini";
        const name=row.querySelector(".userName");
        if(name)name.insertAdjacentElement("afterend",mini);
      }

      if(a.key==="anthropic" && st.status==="out"){
        ensureBadge(row,"SLEEP","sleep","Claude is ready for Haiku 4.5 when API credit is available.");
        mini.textContent="Haiku 4.5";
      }else if(
        a.key==="xai" &&
        st.route==="latitude/grok-build"
      ){

        if(providerReady.xai){

          ensureBadge(
            row,
            "LOCAL",
            "free",
            "Grok Build is running headlessly on Kyle's Latitude."
          );

        }else{

          row.querySelector(
            ".freeLifeBadge"
          )?.remove();

        }

        mini.textContent=
          "Grok Build";

      }else if(
        a.key==="xai" &&
        !providerReady.xai
      ){

        ensureBadge(
          row,
          "SLEEP",
          "sleep",
          "Start the Latitude Grok worker or fund the xAI API."
        );

        mini.textContent=
          "Grok 4.3";

      }else if(
        ["deepseek","mistral","openrouter"]
        .includes(a.key)
      ){
        if(st.status==="ready"){
          ensureBadge(row,"FREE","free",st.route||"FREE-LIFE");
        }
        mini.textContent=shortModel(model||(
          a.key==="openrouter"?"openrouter/free":
          a.key==="deepseek"?"DeepSeek free":
          "Mistral free"
        ));
      }else{
        mini.textContent=model?shortModel(model):"";
      }

      row.title=[
        row.title||"",
        model?`model: ${model}`:"",
        st.route?`route: ${st.route}`:"",
        st.reason?`status: ${st.reason}`:"",
        a.key==="openrouter"?`local free reserve: ${fl.openrouterCalls}/${fl.limit}`:""
      ].filter(Boolean).join(" · ");
    });
  }

  migrate();

  const originalRender=render;
  render=function(){
    originalRender();
    enhanceRoster();
  };

  render();
  enhanceRoster();
})();

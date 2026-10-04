(()=>{
  try{
    if(typeof S==="undefined")return;

    const target="gemini-3.5-flash-lite";

    S.profiles=S.profiles||{};
    S.profiles.gemini=Object.assign({},S.profiles.gemini||{},{
      model:target,
      plan:"auto"
    });

    S.providerState=S.providerState||{};
    S.providerState.gemini=Object.assign(
      {},
      S.providerState.gemini||{},
      {status:"ready",reason:"FREE-MAX: stable Flash-Lite"}
    );

    S.geminiFreeMaxVersion=1;

    if(typeof save==="function")save();
    if(typeof render==="function")render();
    if(typeof renderProviderStatus==="function")renderProviderStatus();

    console.log("[Gemmy] FREE-MAX enabled:",target);
  }catch(e){
    console.warn("[Gemmy] FREE-MAX client migration failed:",e);
  }
})();

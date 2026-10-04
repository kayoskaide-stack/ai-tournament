(()=>{
  const STYLE_ID="adaptive-display-v1";
  const BODY_CLASS="adaptiveDisplay";

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;

    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
body.${BODY_CLASS}{
  --ad-chat:10px;
  --ad-nick:90px;
  --ad-topic:10px;
  --ad-user:9px;
  --ad-small:8px;
  --ad-menu:8px;
  --ad-input:13px;
  --ad-gap:4px;
  --ad-live:58px;
  --ad-icon:38px;
  --ad-send:48px;
}

body.${BODY_CLASS} .main{
  grid-template-columns:minmax(0,1fr) var(--ad-nick)!important;
  width:100%!important;
  min-width:0!important;
  max-width:100%!important;
}

body.${BODY_CLASS} #chat{
  min-width:0!important;
  padding:7px 6px 70px!important;
}

body.${BODY_CLASS} #chat .line{
  font-size:var(--ad-chat)!important;
  line-height:1.38!important;
  padding-right:20px!important;
}

body.${BODY_CLASS} #chat .time{
  font-size:calc(var(--ad-chat) - 1px)!important;
}

body.${BODY_CLASS} #chat .typing,
body.${BODY_CLASS} #chat .providerError{
  font-size:var(--ad-chat)!important;
}

body.${BODY_CLASS} .joinBanner.topicText{
  font-size:var(--ad-chat)!important;
  line-height:1.4!important;
}

body.${BODY_CLASS} #topic{
  font-size:var(--ad-topic)!important;
  margin-top:5px!important;
}

body.${BODY_CLASS} #menuBar{
  margin-bottom:4px!important;
}

body.${BODY_CLASS} #menuBar button{
  font-size:var(--ad-menu)!important;
  padding:3px 5px!important;
}

body.${BODY_CLASS} header{
  padding-left:7px!important;
  padding-right:7px!important;
  padding-bottom:7px!important;
}

body.${BODY_CLASS} .heading{
  gap:6px!important;
}

body.${BODY_CLASS} .heading b{
  font-size:calc(var(--ad-chat) + 2px)!important;
}

body.${BODY_CLASS} .heading small{
  font-size:var(--ad-small)!important;
  padding:1px 4px!important;
}

body.${BODY_CLASS} #deviceBadge{
  font-size:var(--ad-small)!important;
}

body.${BODY_CLASS} .heading #settingsBtn{
  font-size:16px!important;
  padding:2px 4px!important;
}

body.${BODY_CLASS} #nickPanel{
  width:auto!important;
  min-width:0!important;
  padding:6px 3px!important;
}

body.${BODY_CLASS} #nickPanel h3{
  font-size:var(--ad-small)!important;
  margin:0 0 5px!important;
  letter-spacing:0!important;
}

body.${BODY_CLASS} #users .user{
  font-size:var(--ad-user)!important;
  padding:4px 0!important;
  min-width:0!important;
}

body.${BODY_CLASS} #users .aiUser{
  gap:2px!important;
}

body.${BODY_CLASS} #users .userName{
  font-size:var(--ad-user)!important;
}

body.${BODY_CLASS} #users .aiState{
  font-size:calc(var(--ad-small) - 1px)!important;
  line-height:11px!important;
  padding:0 1px!important;
  letter-spacing:0!important;
}

body.${BODY_CLASS} #users .fundMini{
  font-size:calc(var(--ad-small) - 1px)!important;
  line-height:12px!important;
  min-width:15px!important;
  padding:0 1px!important;
}

body.${BODY_CLASS} #scoreboard{
  font-size:var(--ad-small)!important;
  margin-top:6px!important;
  padding-top:5px!important;
}

body.${BODY_CLASS} .scoreTitle,
body.${BODY_CLASS} .scoreRow{
  font-size:var(--ad-small)!important;
}

body.${BODY_CLASS} .scoreRow{
  padding:3px 0!important;
}

body.${BODY_CLASS} .medals{
  font-size:calc(var(--ad-small) + 1px)!important;
}

body.${BODY_CLASS} .laughBar{
  gap:2px!important;
  margin:4px 0 1px 42px!important;
}

body.${BODY_CLASS} .laughBar button{
  font-size:var(--ad-small)!important;
  padding:2px 4px!important;
}

body.${BODY_CLASS} footer{
  grid-template-columns:
    var(--ad-live)
    var(--ad-icon)
    var(--ad-icon)
    minmax(0,1fr)
    var(--ad-send)!important;
  gap:var(--ad-gap)!important;
  padding-left:4px!important;
  padding-right:4px!important;
  padding-top:5px!important;
  padding-bottom:max(5px,env(safe-area-inset-bottom))!important;
}

body.${BODY_CLASS} #liveBtn{
  width:var(--ad-live)!important;
  min-width:0!important;
  padding:0 2px!important;
  font-size:calc(var(--ad-input) - 2px)!important;
}

body.${BODY_CLASS} #photoBtn,
body.${BODY_CLASS} #colourBtn{
  width:var(--ad-icon)!important;
  min-width:0!important;
  padding:0!important;
  font-size:calc(var(--ad-input) + 3px)!important;
}

body.${BODY_CLASS} #send{
  width:var(--ad-send)!important;
  min-width:0!important;
  padding:0 2px!important;
  font-size:calc(var(--ad-input) - 1px)!important;
}

body.${BODY_CLASS} footer #input{
  width:100%!important;
  min-width:0!important;
  padding:7px 6px!important;
  font-size:var(--ad-input)!important;
}

body.${BODY_CLASS} #layoutDock button{
  font-size:var(--ad-small)!important;
  min-height:29px!important;
  padding:3px 5px!important;
}

body.${BODY_CLASS} .speakOne{
  width:20px!important;
  height:20px!important;
  font-size:11px!important;
}

body.${BODY_CLASS}.adLandscape #chat{
  padding-bottom:55px!important;
}

body.${BODY_CLASS}.adMicro .laughBar{
  margin-left:30px!important;
}
`;
    document.head.appendChild(style);
  }

  function family(){
    const ua=navigator.userAgent||"";
    if(/SamsungBrowser|SM-[A-Z0-9]/i.test(ua))return"Samsung";
    if(/Pixel/i.test(ua))return"Pixel";
    if(/iPhone|iPad|iPod/i.test(ua))return"iOS";
    if(/Android/i.test(ua))return"Android";
    return"Mobile";
  }

  function viewport(){
    const vv=window.visualViewport;
    const w=Math.max(280,Math.round(vv?.width||window.innerWidth||document.documentElement.clientWidth));
    const h=Math.max(300,Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight));
    return{w,h};
  }

  function setVar(name,value){
    document.body.style.setProperty(name,value);
  }

  function applyAdaptiveDisplay(){
    ensureStyle();

    const {w,h}=viewport();
    const coarse=matchMedia("(pointer:coarse)").matches;
    const touch=("ontouchstart" in window)||navigator.maxTouchPoints>0;
    const phoneLike=(coarse||touch)&&w<=760;

    if(!phoneLike){
      document.body.classList.remove(BODY_CLASS,"adMicro","adTiny","adCompact","adLandscape");
      return;
    }

    let chat=11;
    let nick=98;
    let user=9.5;
    let small=8;
    let topic=10;
    let input=13;
    let gap=4;
    let live=58;
    let icon=38;
    let send=48;

    if(w<=330){
      chat=8.5; nick=76; user=7.5; small=6.5; topic=8;
      input=11; gap=2; live=49; icon=31; send=42;
    }else if(w<=360){
      chat=9; nick=80; user=8; small=7; topic=8.5;
      input=11.5; gap=2; live=51; icon=33; send=43;
    }else if(w<=390){
      chat=9.5; nick=84; user=8.5; small=7; topic=9;
      input=12; gap=3; live=53; icon=34; send=44;
    }else if(w<=430){
      chat=10; nick=90; user=9; small=7.5; topic=9.5;
      input=12.5; gap=3; live=55; icon=36; send=46;
    }else if(w<=480){
      chat=10.5; nick=96; user=9.5; small=8; topic=10;
      input=13; gap=4; live=58; icon=38; send=48;
    }else if(w<=600){
      chat=11.5; nick=106; user=10; small=8.5; topic=10.5;
      input=13.5; gap=5; live=64; icon=42; send=52;
    }else{
      chat=12.5; nick=118; user=10.5; small=9; topic=11;
      input=14; gap=5; live=72; icon=44; send=56;
    }

    const landscape=w>h;
    if(landscape&&h<500){
      chat=Math.max(8.5,chat-0.75);
      nick=Math.max(76,nick-4);
      user=Math.max(7.5,user-0.5);
      small=Math.max(6.5,small-0.5);
      topic=Math.max(8,topic-0.5);
      input=Math.max(11,input-0.5);
    }

    document.body.classList.add(BODY_CLASS);
    document.body.classList.toggle("adMicro",w<=330);
    document.body.classList.toggle("adTiny",w>330&&w<=390);
    document.body.classList.toggle("adCompact",w>390&&w<=480);
    document.body.classList.toggle("adLandscape",landscape);

    setVar("--ad-chat",chat+"px");
    setVar("--ad-nick",nick+"px");
    setVar("--ad-user",user+"px");
    setVar("--ad-small",small+"px");
    setVar("--ad-topic",topic+"px");
    setVar("--ad-menu",Math.max(7,small)+"px");
    setVar("--ad-input",input+"px");
    setVar("--ad-gap",gap+"px");
    setVar("--ad-live",live+"px");
    setVar("--ad-icon",icon+"px");
    setVar("--ad-send",send+"px");

    document.body.dataset.viewport=`${w}x${h}`;
    document.body.dataset.deviceFamily=family();

    const badge=document.querySelector("#deviceBadge");
    if(badge)badge.textContent=`${family()} · ${w}px`;
  }

  let timer=0;
  function queue(){
    clearTimeout(timer);
    timer=setTimeout(applyAdaptiveDisplay,60);
  }

  applyAdaptiveDisplay();
  addEventListener("resize",queue,{passive:true});
  addEventListener("orientationchange",queue,{passive:true});
  if(window.visualViewport){
    visualViewport.addEventListener("resize",queue,{passive:true});
    visualViewport.addEventListener("scroll",queue,{passive:true});
  }

  const ro=new ResizeObserver(queue);
  ro.observe(document.documentElement);
})();

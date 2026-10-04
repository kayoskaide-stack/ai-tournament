(()=>{
  const sendBtn=document.querySelector("#send");

  /* Fix iPhone tap passing PointerEvent into send() */
  if(sendBtn && typeof send==="function"){
    sendBtn.onclick=e=>{
      if(e && e.preventDefault)e.preventDefault();
      return send("");
    };
  }

  /* Compact mobile-only roster */
  const style=document.createElement("style");
  style.id="mobile-arena-hotfix-v1";
  style.textContent=`
@media (max-width:700px){
  :root{--nick-width:94px!important}

  .main{
    grid-template-columns:minmax(0,1fr) 94px!important;
  }

  #nickPanel{
    padding:8px 3px!important;
  }

  #nickPanel h3{
    font-size:8px!important;
    margin:0 0 7px!important;
    letter-spacing:0!important;
  }

  #collapseNicks{
    font-size:15px!important;
    padding:0 2px!important;
  }

  #users .user{
    font-size:9px!important;
    padding:5px 0!important;
  }

  #users .aiUser{
    gap:2px!important;
    overflow:visible!important;
  }

  #users .aiUser .userName{
    font-size:9px!important;
    min-width:0!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }

  #users .aiState{
    font-size:6px!important;
    line-height:11px!important;
    padding:0 1px!important;
    letter-spacing:0!important;
    border-radius:2px!important;
  }

  #users .fundMini{
    font-size:7px!important;
    line-height:12px!important;
    padding:0 1px!important;
    min-width:15px!important;
    text-align:center!important;
    border-radius:3px!important;
  }

  #scoreboard{
    margin-top:8px!important;
    padding-top:6px!important;
    font-size:7px!important;
  }

  .scoreTitle{
    font-size:7px!important;
    margin-bottom:4px!important;
  }

  .scoreRow{
    font-size:7px!important;
    padding:3px 0!important;
  }

  .medals{
    font-size:9px!important;
  }
}

@media (max-width:380px){
  :root{--nick-width:90px!important}

  .main{
    grid-template-columns:minmax(0,1fr) 90px!important;
  }

  #users .user,
  #users .aiUser .userName{
    font-size:8px!important;
  }
}
`;
  document.head.appendChild(style);
})();

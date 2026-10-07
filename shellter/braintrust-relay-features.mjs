import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export function safeIrcText(v,max=380){
  return String(v??"").replace(/[\r\n\0]+/g," ").slice(0,max);
}

export function privateMessage(send,nick,text){
  send(`PRIVMSG ${safeIrcText(nick,64)} :${safeIrcText(text)}`);
}

export function dccSend(send,nick,filePath,publicIp,port,fileSize){
  const base=path.basename(filePath).replace(/["\s]+/g,"_");
  const ipNum=String(publicIp||"").split(".").reduce((a,n)=>(a*256+(+n||0))>>>0,0);
  if(!ipNum||!port) throw Error("DCC requires public IPv4 + listening port.");
  send(`PRIVMSG ${safeIrcText(nick,64)} :\x01DCC SEND ${base} ${ipNum} ${Number(port)} ${Number(fileSize||fs.statSync(filePath).size)}\x01`);
}

export function runLegacyTool(name,args,{cwd,timeoutMs=30000}={}){
  const map={
    catfish:process.env.BRAINTRUST_CATFISH_CMD,
    hunt:process.env.BRAINTRUST_HUNT_CMD,
    ascii:process.env.BRAINTRUST_ASCII_CMD
  };
  const cmd=String(map[name]||"").trim();
  if(!cmd) return Promise.reject(Error(`${name} tool command is not configured.`));
  return new Promise((resolve,reject)=>{
    const p=spawn("/bin/sh",["-lc",`${cmd} "$@"`,"braintrust-tool",...args],{cwd,stdio:["ignore","pipe","pipe"]});
    let out="",err="";
    p.stdout.on("data",d=>out+=d);
    p.stderr.on("data",d=>err+=d);
    const timer=setTimeout(()=>{p.kill("SIGKILL");reject(Error(`${name} timed out`))},timeoutMs);
    p.on("close",code=>{
      clearTimeout(timer);
      if(code===0) resolve(out.slice(0,12000));
      else reject(Error(`${name} exited ${code}: ${err.slice(0,1000)}`));
    });
  });
}

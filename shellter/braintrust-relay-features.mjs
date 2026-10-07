
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";

export function safeIrcText(v,max=380){return String(v??"").replace(/[\r\n\0]+/g," ").trim().slice(0,max)}
export function privateMessage(send,nick,text){const target=safeIrcText(nick,64);if(!target)throw Error("IRC nick is required.");send(`PRIVMSG ${target} :${safeIrcText(text,1600)}`)}
function ipv4Number(publicIp){
  const parts=String(publicIp||"").trim().split(".");
  if(parts.length!==4||parts.some(x=>!/^\d+$/.test(x)||Number(x)>255))throw Error("DCC requires a valid public IPv4 address.");
  return String(parts.reduce((a,n)=>((a*256)+Number(n))>>>0,0));
}
function allowedFile(filePath,root){
  const rootReal=fs.realpathSync(root||process.env.HOME||"."),fileReal=fs.realpathSync(filePath),prefix=rootReal.endsWith(path.sep)?rootReal:rootReal+path.sep;
  if(fileReal!==rootReal&&!fileReal.startsWith(prefix))throw Error("DCC file is outside BRAINTRUST_DCC_ROOT.");
  const st=fs.statSync(fileReal);if(!st.isFile())throw Error("DCC path is not a regular file.");return{fileReal,st};
}
export async function dccSend(send,nick,filePath,publicIp,port,{root,timeoutMs=120000}={}){
  const {fileReal,st}=allowedFile(filePath,root),requested=Number(port);
  if(!Number.isInteger(requested)||requested<1024||requested>65535)throw Error("DCC port is invalid.");
  const server=net.createServer(socket=>{const stream=fs.createReadStream(fileReal);stream.on("error",()=>socket.destroy());stream.pipe(socket);socket.on("close",()=>server.close())});
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(requested,"0.0.0.0",resolve)});
  const timer=setTimeout(()=>server.close(),timeoutMs);server.on("close",()=>clearTimeout(timer));
  const base=path.basename(fileReal).replace(/["\s]+/g,"_");
  send(`PRIVMSG ${safeIrcText(nick,64)} :\x01DCC SEND ${base} ${ipv4Number(publicIp)} ${requested} ${st.size}\x01`);
  return{ok:true,file:base,size:st.size,port:requested};
}
export function runLegacyTool(name,args,{cwd,timeoutMs=30000}={}){
  const map={catfish:process.env.BRAINTRUST_CATFISH_CMD,hunt:process.env.BRAINTRUST_HUNT_CMD,ascii:process.env.BRAINTRUST_ASCII_CMD},cmd=String(map[name]||"").trim();
  if(!cmd)return Promise.reject(Error(`${name} tool command is not configured.`));
  return new Promise((resolve,reject)=>{
    const p=spawn("/bin/sh",["-lc",`${cmd} "$@"`,"braintrust-tool",...args],{cwd,stdio:["ignore","pipe","pipe"]});let out="",err="";
    p.stdout.on("data",d=>out+=d);p.stderr.on("data",d=>err+=d);
    const timer=setTimeout(()=>{p.kill("SIGKILL");reject(Error(`${name} timed out`))},timeoutMs);
    p.on("close",code=>{clearTimeout(timer);if(code===0)resolve(out.slice(0,12000));else reject(Error(`${name} exited ${code}: ${err.slice(0,1000)}`))});
  });
}

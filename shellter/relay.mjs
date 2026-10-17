import net from "node:net";
import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { privateMessage, dccSend, runLegacyTool } from "./braintrust-relay-features.mjs";
// BEGIN embedded identity gate (single-file Shellter deployment)
const fold = value => String(value || "").toLowerCase().replace(/[\[\]\\^]/g, c => ({"[":"{", "]":"}", "\\":"|", "^":"~"}[c]));
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const TTL = 15 * 60 * 1000;

// The relay owns verification state. Vercel instances never trust a browser's
// claimed account or keep the only copy of a verification in process memory.
function createIdentityGate({ send, nick, file, now = Date.now }) {
  let rows = {};
  try { rows = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { if (e.code !== "ENOENT") throw e; }
  const pending = new Map();
  function save() {
    for (const [id, row] of Object.entries(rows)) if (row.expires <= now()) delete rows[id];
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file + ".tmp", JSON.stringify(rows), { mode: 0o600 });
    fs.renameSync(file + ".tmp", file);
  }
  function start(binding) {
    if (typeof binding !== "string" || binding.length < 30 || binding.length > 300) throw Error("Invalid identity binding.");
    save();
    const owner = digest(binding);
    let pair = Object.entries(rows).find(([, row]) => row.owner === owner);
    if (!pair) {
      if (Object.keys(rows).length >= 1000) throw Error("Identity service busy.");
      const code = crypto.randomBytes(24).toString("hex");
      rows[code] = { owner, expires: now() + TTL };
      save(); pair = [code, rows[code]];
    }
    return { ok: true, challenge: pair[0], command: `/msg ${nick} !verify ${pair[0]}`, expiresAt: pair[1].expires };
  }
  function status(binding, code) {
    const row = rows[code];
    if (!row || row.expires <= now() || row.owner !== digest(String(binding || ""))) throw Error("Verification expired or not found.");
    return { verified: Boolean(row.account), account: row.account || "" };
  }
  function consumeEmail(nonce, expires) {
    if (!/^[a-f0-9]{48}$/.test(nonce || "") || !Number.isFinite(expires) || expires <= now() || expires > now() + TTL) throw Error("Invalid email confirmation.");
    save();
    const key = `email:${digest(nonce)}`;
    if (rows[key]) throw Error("Email confirmation already used. Request a new link.");
    rows[key] = { expires };
    save();
    return { ok: true };
  }
  function handle(msg) {
    if (["QUIT", "NICK"].includes(msg.command)) pending.delete(fold(msg.prefix.split("!")[0]));
    // Only a private message carrying the secret challenge proves control of
    // the IRC nickname. The private room need not be joined to verify.
    if (msg.command === "PRIVMSG" && fold(msg.params[0]) === fold(nick)) {
      const code = /^!verify ([a-f0-9]{48})$/.exec(msg.trailing || "")?.[1];
      const row = rows[code];
      if (!row || row.expires <= now() || row.account || !msg.prefix.includes("!")) return false;
      const who = msg.prefix.split("!")[0], key = fold(who);
      const previous = pending.get(key);
      if (previous && now() - previous.at < 15000) return true;
      pending.set(key, { code, at: now(), account: "", prefix: msg.prefix });
      send(`WHOIS ${who} ${who}`);
      return true;
    }
    // Numeric messages must come from a server, never from a user prefix.
    if (!msg.prefix || msg.prefix.includes("!") || fold(msg.params[0]) !== fold(nick)) return false;
    const key = fold(msg.params[1]), check = pending.get(key);
    if (!check || now() - check.at > 15000) { pending.delete(key); return false; }
    if (msg.command === "330") {
      const account = String(msg.params[2] || "");
      if (/^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/.test(account)) check.account = account;
      return true;
    }
    if (["318", "401"].includes(msg.command)) {
      pending.delete(key);
      const row = rows[check.code];
      if (msg.command === "318" && check.account && row && row.expires > now()) {
        row.account = check.account;
        save();
        send(`NOTICE ${msg.params[1]} :CService verified. Return to Brain Trust and select Check verification.`);
      } else send(`NOTICE ${msg.params[1]} :Please log in to X first, then send the verification command again.`);
      return true;
    }
    return false;
  }
  return { start, status, consumeEmail, handle, reset() { pending.clear(); } };
}
// END embedded identity gate

const env=process.env;
const cfg={
  enabled:env.IRC_ENABLED==="1",server:env.IRC_SERVER||"irc.undernet.org",port:Number(env.IRC_PORT||6667),localAddress:env.IRC_LOCAL_ADDRESS||undefined,
  nick:env.IRC_NICK||"PrincessGPTBot",user:env.IRC_USER||"princessgpt",realname:env.IRC_REALNAME||"PrincessGPT IRC Relay",channel:env.IRC_CHANNEL||"#ai-tournament",channelKey:env.IRC_CHANNEL_KEY||"",enforceModes:env.IRC_ENFORCE_MODES==="1",
  username:env.UNDERNET_USERNAME||"",password:env.UNDERNET_PASSWORD||"",arena:(env.ARENA_BASE_URL||"").replace(/\/+$/, ""),relayKey:env.ARENA_RELAY_KEY||"",persona:env.PERSONA||"PrincessGPT",provider:env.PROVIDER||"openai",model:env.MODEL||"",
  maxReplyChars:Number(env.MAX_REPLY_CHARS||350),minReplyInterval:Number(env.MIN_REPLY_INTERVAL_MS||4000),reconnectDelay:Number(env.RECONNECT_DELAY_MS||5000),logFile:env.LOG_FILE||"logs/irc-relay.jsonl",
  bridgeHost:env.BRAINTRUST_BRIDGE_HOST||"127.0.0.1",bridgePort:Number(env.BRAINTRUST_BRIDGE_PORT||8788),httpsHost:env.BRAINTRUST_HTTPS_HOST||"0.0.0.0",httpsPort:Number(env.BRAINTRUST_HTTPS_PORT||0),tlsKey:env.BRAINTRUST_TLS_KEY||"",tlsCert:env.BRAINTRUST_TLS_CERT||"",bridgeToken:env.BRAINTRUST_RELAY_TOKEN||env.ARENA_RELAY_KEY||"",
  dccPublicIpv4:env.BRAINTRUST_DCC_PUBLIC_IPV4||"",dccPort:Number(env.BRAINTRUST_DCC_PORT||0),dccRoot:env.BRAINTRUST_DCC_ROOT||env.HOME||".",
  ownerAccounts:new Set(String(env.BRAINTRUST_IRC_OWNER_ACCOUNTS||env.BRAINTRUST_IRC_OWNER_ACCOUNT||"").split(/[\s,;]+/).map(x=>fold(x)).filter(Boolean))
};
let socket=null,buffer="",reconnectTimer=null,shuttingDown=false,lastReplyAt=0,replyBusy=false,bridgeServer=null,httpsBridgeServer=null,ownOperator=false;
const adminPending=new Map();
function enforceRoomGate(){if(ownOperator&&cfg.enforceModes)send(cfg.channelKey?`MODE ${cfg.channel} +ntskr ${cfg.channelKey}`:`MODE ${cfg.channel} +ntsr`)}
const identityGate=createIdentityGate({send,nick:cfg.nick,file:path.join(process.cwd(),"data","identity-challenges.json")});
function tournamentDelayMs(){const who=`${cfg.persona} ${cfg.provider}`.toLowerCase();if(who.includes("princess"))return 0;if(who.includes("gem"))return 2500;if(who.includes("claude")||who.includes("anthropic"))return 5000;if(who.includes("deepseek"))return 7500;if(who.includes("mistral"))return 10000;if(who.includes("openrouter"))return 12500;return 6000}
function log(event,data={}){const row={ts:new Date().toISOString(),event,...data};console.log(JSON.stringify(row));try{fs.mkdirSync(path.dirname(cfg.logFile),{recursive:true});fs.appendFileSync(cfg.logFile,JSON.stringify(row)+"\n")}catch{}}
function requireConfig(){const missing=[];if(!cfg.arena||cfg.arena.includes("YOUR-VERCEL-DOMAIN"))missing.push("ARENA_BASE_URL");if(!cfg.relayKey||cfg.relayKey.length<16)missing.push("ARENA_RELAY_KEY");if(!cfg.channel.startsWith("#"))missing.push("IRC_CHANNEL");if(missing.length)throw Error(`Missing/invalid configuration: ${missing.join(", ")}`)}
function send(line){if(!socket||socket.destroyed)return false;let logged=String(line);for(const secret of [cfg.password,cfg.channelKey,cfg.bridgeToken])if(secret)logged=logged.split(secret).join("[REDACTED]");log("irc_out",{line:logged});socket.write(line+"\r\n");return true}
function safeEqual(a,b){const A=Buffer.from(String(a||""),"utf8"),B=Buffer.from(String(b||""),"utf8");return A.length>0&&A.length===B.length&&crypto.timingSafeEqual(A,B)}
function bridgeAuthorized(req){const h=String(req.headers?.authorization||"");return h.toLowerCase().startsWith("bearer ")&&safeEqual(h.slice(7).trim(),cfg.bridgeToken)}
function bridgeJson(res,status,data){res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(data))}
function readBridgeBody(req){return new Promise((resolve,reject)=>{let raw="";req.on("data",chunk=>{raw+=chunk;if(raw.length>1024*1024){reject(Error("request too large"));req.destroy()}});req.on("end",()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(Error("invalid JSON"))}});req.on("error",reject)})}
async function bridgeRequest(req,res){try{const u=new URL(req.url||"/","https://relay.local");if(!bridgeAuthorized(req))return bridgeJson(res,401,{error:"Unauthorized relay bridge."});if(req.method==="GET"&&u.pathname==="/health")return bridgeJson(res,200,{ok:true,connected:Boolean(socket&&!socket.destroyed),nick:cfg.nick,channel:cfg.channel,server:cfg.server,ircOwnerControlConfigured:cfg.ownerAccounts.size>0});if(req.method!=="POST")return bridgeJson(res,405,{error:"POST only"});const body=await readBridgeBody(req);if(u.pathname==="/identity/consume-email")return bridgeJson(res,200,identityGate.consumeEmail(body.nonce,body.expires));if(u.pathname==="/identity/start")return bridgeJson(res,200,identityGate.start(body.binding));if(u.pathname==="/identity/status")return bridgeJson(res,200,identityGate.status(body.binding,body.challenge));if(u.pathname==="/pm"){privateMessage(send,body.nick,body.text);return bridgeJson(res,200,{ok:true,queued:true,nick:String(body.nick||"")})}if(u.pathname==="/tool"){const name=String(body.name||"").toLowerCase();if(!["catfish","hunt","ascii"].includes(name))return bridgeJson(res,400,{error:"Unknown tool."});const output=await runLegacyTool(name,Array.isArray(body.args)?body.args.map(String):[],{cwd:process.cwd()});return bridgeJson(res,200,{ok:true,name,output})}if(u.pathname==="/dcc"){const result=await dccSend(send,body.nick,body.filePath,cfg.dccPublicIpv4,cfg.dccPort,{root:cfg.dccRoot});return bridgeJson(res,200,result)}return bridgeJson(res,404,{error:"Unknown relay bridge route."})}catch(e){log("bridge_error",{error:e?.message||String(e)});return bridgeJson(res,500,{error:e?.message||String(e)})}}
function startBridge(){if(bridgeServer||httpsBridgeServer)return;if(!cfg.bridgeToken||cfg.bridgeToken.length<16)throw Error("BRAINTRUST_RELAY_TOKEN/ARENA_RELAY_KEY must be at least 16 characters.");bridgeServer=http.createServer(bridgeRequest);bridgeServer.listen(cfg.bridgePort,cfg.bridgeHost,()=>log("bridge_listening",{scheme:"http",host:cfg.bridgeHost,port:cfg.bridgePort}));bridgeServer.on("error",e=>log("bridge_server_error",{error:e.message||String(e)}));if(cfg.httpsPort>0){if(!cfg.tlsKey||!cfg.tlsCert)throw Error("HTTPS enabled but TLS key/certificate paths are missing.");httpsBridgeServer=https.createServer({key:fs.readFileSync(cfg.tlsKey),cert:fs.readFileSync(cfg.tlsCert)},bridgeRequest);httpsBridgeServer.listen(cfg.httpsPort,cfg.httpsHost,()=>log("https_bridge_listening",{scheme:"https",host:cfg.httpsHost,port:cfg.httpsPort}));httpsBridgeServer.on("error",e=>log("https_bridge_error",{error:e.message||String(e)}))}}
function safeIrcText(s){return String(s||"").replace(/[\r\n]+/g," ").replace(/\x00/g,"").trim()}
function splitForIrc(text){const clean=safeIrcText(text);if(!clean)return[];const max=Math.max(80,cfg.maxReplyChars),out=[];let rest=clean;while(rest.length>max){let cut=rest.lastIndexOf(" ",max);if(cut<Math.floor(max*.55))cut=max;out.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart()}if(rest)out.push(rest);return out}
function parseLine(line){let rest=line,prefix="";if(rest.startsWith(":")){const i=rest.indexOf(" ");if(i<0)return null;prefix=rest.slice(1,i);rest=rest.slice(i+1)}const parts=rest.split(" "),command=parts.shift()||"";let trailing="";const ti=parts.findIndex(x=>x.startsWith(":"));if(ti>=0){trailing=parts.slice(ti).join(" ").replace(/^:/,"");parts.length=ti}return{prefix,command,params:parts,trailing}}
function nickFromPrefix(prefix){return String(prefix||"").split("!")[0]}
function sendNotice(nick,text){for(const part of splitForIrc(text))send(`NOTICE ${nick} :${part}`)}
async function adminApi(method,body){const r=await fetch(`${cfg.arena}/api/admin?scope=irc-users`,{method,headers:{Authorization:`Bearer ${cfg.bridgeToken}`,Accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});const raw=await r.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={error:raw}}if(!r.ok)throw Error(data.error||`HTTP ${r.status}`);return data}
async function runIrcUserControl(nick,text,account){const parts=String(text||"").trim().replace(/^!?usrctrl\s*/i,"").split(/\s+/).filter(Boolean),sub=(parts.shift()||"help").toLowerCase(),who=parts.shift()||"",arg=parts.shift()||"";log("irc_usrctrl",{nick,account,sub,target:who||undefined});try{
  if(["help","?"].includes(sub)){sendNotice(nick,"usrctrl: list | show NICK | add NICK [member|maintainer] | revoke NICK | activate NICK | role NICK ROLE | rotate NICK. Results and access codes are private NOTICEs.");return}
  if(sub==="list"){const d=await adminApi("GET");for(const u of d.users||[])sendNotice(nick,`${u.nick} · ${String(u.role||"").toUpperCase()} · ${u.verified?"CSERVICE VERIFIED":"PENDING"} · ${u.active?"ACTIVE":"REVOKED"} · rev ${u.rev}`);return}
  if(sub==="show"){if(!who)throw Error("Usage: !usrctrl show NICK");const d=await adminApi("GET"),u=(d.users||[]).find(x=>fold(x.nick)===fold(who));if(!u)throw Error("User not found.");sendNotice(nick,`${u.nick} · ${String(u.role||"").toUpperCase()} · ${u.verified?"CSERVICE VERIFIED":"PENDING"} · ${u.active?"ACTIVE":"REVOKED"} · rev ${u.rev}`);return}
  if(["add","invite"].includes(sub)){if(!who)throw Error("Usage: !usrctrl add NICK [member|maintainer]");const d=await adminApi("POST",{action:"create",nick:who,role:["member","maintainer"].includes(arg.toLowerCase())?arg.toLowerCase():"member"});sendNotice(nick,`INVITE CREATED for ${d.nick} (${d.role}). ONE-TIME ACCESS CODE: ${d.code}`);return}
  if(["revoke","activate","rotate"].includes(sub)){if(!who)throw Error(`Usage: !usrctrl ${sub} NICK`);const d=await adminApi("POST",{action:sub,nick:who});sendNotice(nick,d.code?`${d.nick}: ${sub} complete. NEW ONE-TIME ACCESS CODE: ${d.code}`:`${who}: ${sub} complete.`);return}
  if(sub==="role"){const role=arg.toLowerCase();if(!who||!["member","maintainer"].includes(role))throw Error("Usage: !usrctrl role NICK member|maintainer");await adminApi("POST",{action:"role",nick:who,role});sendNotice(nick,`${who}: role changed to ${role}.`);return}
  throw Error("Unknown usrctrl command. Use !usrctrl help.")
}catch(e){sendNotice(nick,`usrctrl error: ${e.message||e}`)}}
function handleIrcAdmin(msg){const now=Date.now();for(const[k,v]of adminPending)if(now-v.at>15000)adminPending.delete(k);if(msg.command==="PRIVMSG"){const target=String(msg.params[0]||""),text=String(msg.trailing||""),speaker=nickFromPrefix(msg.prefix);if(!speaker||!/^!?usrctrl(?:\s|$)/i.test(text))return false;if(target.toLowerCase()!==cfg.channel.toLowerCase()&&fold(target)!==fold(cfg.nick))return false;const key=fold(speaker);if(!cfg.ownerAccounts.size){sendNotice(speaker,"IRC owner control is locked until BRAINTRUST_IRC_OWNER_ACCOUNTS is configured with an approved CService/X account.");return true}adminPending.set(key,{at:now,nick:speaker,text,account:""});send(`WHOIS ${speaker} ${speaker}`);return true}if(!msg.prefix||msg.prefix.includes("!")||fold(msg.params[0])!==fold(cfg.nick))return false;const key=fold(msg.params[1]),pending=adminPending.get(key);if(!pending)return false;if(msg.command==="330"){const account=String(msg.params[2]||"");if(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/.test(account))pending.account=account;return true}if(["318","401"].includes(msg.command)){adminPending.delete(key);if(msg.command!=="318"||!pending.account||!cfg.ownerAccounts.has(fold(pending.account))){sendNotice(pending.nick,"usrctrl denied: authenticate to an approved CService/X owner account first.");return true}void runIrcUserControl(pending.nick,pending.text,pending.account).catch(e=>sendNotice(pending.nick,`usrctrl error: ${e.message||e}`));return true}return false}
function shouldAnswer(from,target,text){if(!text||!from||nickFromPrefix(from).toLowerCase()===cfg.nick.toLowerCase()||target.toLowerCase()!==cfg.channel.toLowerCase())return false;const lower=text.toLowerCase(),addressed=lower.startsWith(cfg.nick.toLowerCase()+":")||lower.startsWith(cfg.nick.toLowerCase()+",")||lower.includes(cfg.nick.toLowerCase());return addressed||["killercut_","killercut"].includes(nickFromPrefix(from).toLowerCase())}
const conversationHistory=[],historyFile=path.join(process.cwd(),"data","conversation-history.json");
function loadConversationHistory(){try{const saved=JSON.parse(fs.readFileSync(historyFile,"utf8"));if(Array.isArray(saved))conversationHistory.push(...saved.filter(x=>x&&typeof x.role==="string"&&typeof x.text==="string").slice(-24));log("history_loaded",{turns:conversationHistory.length})}catch(e){if(e?.code!=="ENOENT")log("history_load_error",{error:e.message||String(e)})}}
function saveConversationHistory(){try{fs.mkdirSync(path.dirname(historyFile),{recursive:true});const tmp=historyFile+".tmp";fs.writeFileSync(tmp,JSON.stringify(conversationHistory,null,2),{mode:0o600});fs.renameSync(tmp,historyFile);fs.chmodSync(historyFile,0o600)}catch(e){log("history_save_error",{error:e.message||String(e)})}}
loadConversationHistory();saveConversationHistory();
async function askArena(humanMessage,from){if(replyBusy){log("reply_skipped_busy",{from});return}const now=Date.now(),wait=cfg.minReplyInterval-(now-lastReplyAt);if(wait>0){log("reply_skipped_rate_limit",{waitMs:wait,from});return}replyBusy=true;lastReplyAt=now;const roster=[{name:"PrincessGPT",provider:"openai",reasoning:"medium"},{name:"GemmyAI",provider:"gemini",reasoning:"low"},{name:"ClaudeAI",provider:"anthropic",reasoning:"medium"},{name:"DeepSeekAI",provider:"deepseek",reasoning:"medium"},{name:"MistralAI",provider:"mistral",reasoning:"low"},{name:"RouterAI",provider:"openrouter",reasoning:"medium"}];try{const recent=conversationHistory.slice(-20).map(x=>`${x.role}: ${x.text}`).join("\n"),instructions=["This is Kyle's AI tournament room.","PrincessGPT is the IRC mouthpiece, but every bracketed contestant label must correspond to the actual provider that produced that answer.","Never substitute another provider under a contestant's name.","Several AI contestants improve one answer sequentially.","The first available contestant gives a compact useful baseline.","Later contestants must materially improve the existing answer or return PASS exactly.","Never repeat, praise, or paraphrase an existing answer just to speak.","A valid improvement corrects an error, adds an important missing fact, catches an edge case, or gives a substantially better method.","Keep IRC replies compact and natural.","Do not invent facts."].join(" ");let transcript="",consecutivePasses=0,visibleReplies=0;for(const contestant of roster){const body={provider:contestant.provider,name:contestant.name,mode:"tournament",challenge:`${instructions}\n\nRecent conversation:\n${recent||"(none)"}\n\nNewest human message:\n${from}: ${humanMessage}\n\nAI answers already given in THIS round:\n${transcript||"(none yet)"}\n\n${contestant.name}:`,images:[],reasoning:contestant.reasoning,hint:"",used:[]};try{const r=await fetch(`${cfg.arena}/api/relay-contestant`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${cfg.relayKey}`},body:JSON.stringify(body)}),raw=await r.text();let data={};try{data=JSON.parse(raw)}catch{}if(!r.ok){log("contestant_skipped_error",{persona:contestant.name,provider:contestant.provider,status:r.status,error:String(data.error||raw).slice(0,220)});continue}const actual=String(data.actualProvider||data.provider||contestant.provider).toLowerCase();if(actual!==contestant.provider){log("contestant_identity_mismatch",{persona:contestant.name,requested:contestant.provider,actual});continue}const answer=String(data.guess||data.answer||data.reply||"").trim();if(!answer||/^PASS[.!]?$/i.test(answer)){consecutivePasses++;log("tournament_pass",{persona:contestant.name,provider:contestant.provider,model:data.model});if(consecutivePasses>=2&&visibleReplies>0)break;continue}consecutivePasses=0;visibleReplies++;transcript+=(transcript?"\n":"")+`${contestant.name}: ${answer}`;conversationHistory.push({role:contestant.name,text:answer});if(conversationHistory.length>30)conversationHistory.splice(0,conversationHistory.length-30);saveConversationHistory();for(const part of splitForIrc(answer))send(`PRIVMSG ${cfg.channel} :[${contestant.name}] ${part}`);log("tournament_reply",{from,persona:contestant.name,provider:contestant.provider,model:data.model,latency:data.latency,chars:answer.length});await new Promise(resolve=>setTimeout(resolve,900))}catch(e){log("contestant_skipped_error",{persona:contestant.name,provider:contestant.provider,error:e?.message||String(e)})}}log("tournament_complete",{from,visibleReplies})}catch(e){log("arena_error",{error:e?.message||String(e)})}finally{replyBusy=false}}
function handle(line){const msg=parseLine(line);if(!msg)return;if(identityGate.handle(msg))return;if(handleIrcAdmin(msg))return;if(msg.command!=="PRIVMSG"||String(msg.params[0]).toLowerCase()===cfg.channel.toLowerCase())log("irc_in",{line});if(msg.command==="353"&&msg.params.some(p=>p.toLowerCase()===cfg.channel.toLowerCase())){if(msg.trailing.split(/\s+/).some(n=>n.startsWith("@")&&n.slice(1).toLowerCase()===cfg.nick.toLowerCase())){ownOperator=true;enforceRoomGate()}}if(msg.command==="MODE"&&String(msg.params[0]).toLowerCase()===cfg.channel.toLowerCase()){let plus=true,index=2;for(const mode of String(msg.params[1]||"")){if(mode==="+"){plus=true;continue}if(mode==="-"){plus=false;continue}const consumes="ovbk".includes(mode)||(mode==="l"&&plus),arg=consumes?msg.params[index++]:"";if(mode==="o"&&String(arg).toLowerCase()===cfg.nick.toLowerCase()){ownOperator=plus;if(plus)enforceRoomGate()}}}if(msg.command==="PING"){send(`PONG :${msg.trailing||msg.params[0]||""}`);return}if(["001","376","422"].includes(msg.command)){if(cfg.username&&cfg.password)send(`PRIVMSG X@channels.undernet.org :LOGIN ${cfg.username} ${cfg.password}`);if(["376","422"].includes(msg.command))setTimeout(()=>send(cfg.channelKey?`JOIN ${cfg.channel} ${cfg.channelKey}`:`JOIN ${cfg.channel}`),500);return}if(msg.command==="366"&&String(msg.params?.[1]||msg.params?.[0]||"").toLowerCase()===cfg.channel.toLowerCase()){if(cfg.enforceModes){if(cfg.username&&cfg.password)send(`PRIVMSG X@channels.undernet.org :OP ${cfg.channel} ${cfg.nick}`);enforceRoomGate()}return}if(msg.command==="433"){log("nick_in_use",{nick:cfg.nick});shuttingDown=true;try{socket?.destroy()}catch{}return}if(msg.command==="PRIVMSG"){const target=msg.params[0]||"",text=msg.trailing||"",speaker=nickFromPrefix(msg.prefix);if(text&&target.toLowerCase()===cfg.channel.toLowerCase()&&speaker.toLowerCase()!==cfg.nick.toLowerCase()){conversationHistory.push({role:speaker,text});if(conversationHistory.length>24)conversationHistory.splice(0,conversationHistory.length-24);saveConversationHistory()}if(shouldAnswer(msg.prefix,target,text)){const from=nickFromPrefix(msg.prefix),cleaned=text.replace(new RegExp(`^${cfg.nick}[,:]\\s*`,"i"),"").trim(),delay=tournamentDelayMs();log("tournament_scheduled",{from,persona:cfg.persona,delayMs:delay});setTimeout(()=>askArena(cleaned,from),delay)}}}
function connect(){if(shuttingDown)return;log("connecting",{server:cfg.server,port:cfg.port,nick:cfg.nick,channel:cfg.channel,enabled:cfg.enabled,ircOwnerControlConfigured:cfg.ownerAccounts.size>0});socket=net.createConnection({host:cfg.server,port:cfg.port,localAddress:cfg.localAddress});socket.setEncoding("utf8");socket.on("connect",()=>{log("connected");send(`NICK ${cfg.nick}`);send(`USER ${cfg.user} 0 * :${safeIrcText(cfg.realname)}`)});socket.on("data",chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf("\r\n"))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+2);if(line)handle(line)}});socket.on("error",e=>log("socket_error",{error:e.message||String(e)}));socket.on("close",()=>{ownOperator=false;identityGate.reset();adminPending.clear();log("disconnected");socket=null;if(!shuttingDown){log("restarting_for_failover",{delay:cfg.reconnectDelay});setTimeout(()=>process.exit(75),cfg.reconnectDelay)}})}
function shutdown(signal){if(shuttingDown)return;shuttingDown=true;log("shutdown",{signal});clearTimeout(reconnectTimer);try{bridgeServer?.close()}catch{}try{httpsBridgeServer?.close()}catch{}try{socket?.end("QUIT :PrincessGPT relay shutting down\r\n")}catch{}setTimeout(()=>process.exit(0),500)}
process.on("SIGINT",()=>shutdown("SIGINT"));process.on("SIGTERM",()=>shutdown("SIGTERM"));
try{requireConfig();startBridge();if(!cfg.enabled){log("disabled",{message:"Relay is built but disabled. Set IRC_ENABLED=1 only when ready for a controlled Undernet test."});process.exit(0)}connect()}catch(err){log("configuration_error",{error:err.message||String(err)});process.exit(1)}

import net from "node:net";
import fs from "node:fs";
import path from "node:path";
const env = process.env;
const cfg = {
  enabled: env.IRC_ENABLED === "1",
  server: env.IRC_SERVER || "irc.undernet.org",
  port: Number(env.IRC_PORT || 6667),
  localAddress: env.IRC_LOCAL_ADDRESS || undefined,
  nick: env.IRC_NICK || "PrincessGPTBot",
  user: env.IRC_USER || "princessgpt",
  realname: env.IRC_REALNAME || "PrincessGPT IRC Relay",
  channel: env.IRC_CHANNEL || "#ai-tournament",
  channelKey: env.IRC_CHANNEL_KEY || "",
  enforceModes: env.IRC_ENFORCE_MODES === "1",
  username: env.UNDERNET_USERNAME || "",
  password: env.UNDERNET_PASSWORD || "",
  arena: (env.ARENA_BASE_URL || "").replace(/\/+$/, ""),
  relayKey: env.ARENA_RELAY_KEY || "",
  persona: env.PERSONA || "PrincessGPT",
  provider: env.PROVIDER || "openai",
  model: env.MODEL || "",
  maxReplyChars: Number(env.MAX_REPLY_CHARS || 350),
  minReplyInterval: Number(env.MIN_REPLY_INTERVAL_MS || 4000),
  reconnectDelay: Number(env.RECONNECT_DELAY_MS || 5000),
  logFile: env.LOG_FILE || "logs/irc-relay.jsonl"
};
let socket = null;
let buffer = "";
let reconnectTimer = null;
let shuttingDown = false;
let lastReplyAt = 0;
let replyBusy = false;
const cservicePending = new Map();

function tournamentDelayMs() {
  const who = `${cfg.persona} ${cfg.provider}`.toLowerCase();

  if (who.includes("princess")) return 0;
  if (who.includes("gem")) return 2500;
  if (who.includes("claude") || who.includes("anthropic")) return 5000;
  if (who.includes("deepseek")) return 7500;
  if (who.includes("mistral")) return 10000;
  if (who.includes("openrouter")) return 12500;

  return 6000;
}
function log(event, data = {}) {
  const row = { ts: new Date().toISOString(), event, ...data };
  console.log(JSON.stringify(row));
  try {
    fs.mkdirSync(path.dirname(cfg.logFile), { recursive: true });
    fs.appendFileSync(cfg.logFile, JSON.stringify(row) + "\n");
  } catch {}
}
function requireConfig() {
  const missing = [];
  if (!cfg.arena || cfg.arena.includes("YOUR-VERCEL-DOMAIN")) {
    missing.push("ARENA_BASE_URL");
  }
  if (!cfg.relayKey || cfg.relayKey.length < 16) {
    missing.push("ARENA_RELAY_KEY");
  }
  if (!cfg.channel.startsWith("#")) {
    missing.push("IRC_CHANNEL");
  }
  if (missing.length) {
    throw new Error(`Missing/invalid configuration: ${missing.join(", ")}`);
  }
}
function send(line) {
  if (!socket || socket.destroyed) return false;
  let logged = String(line);
  for (const secret of [cfg.password, cfg.channelKey]) {
    if (secret) logged = logged.split(secret).join("[REDACTED]");
  }
  log("irc_out", { line: logged });
  socket.write(line + "\r\n");
  return true;
}
function safeIrcText(s) {
  return String(s || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\x00/g, "")
    .trim();
}
function isXPrefix(prefix) {
  const p = String(prefix || "").toLowerCase();
  return p === "x" || p.startsWith("x!") || p.startsWith("x@");
}

async function reportCserviceResult(pending, result) {
  try {
    const r = await fetch(`${cfg.arena}/api/cservice?action=relay-verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.relayKey}`
      },
      body: JSON.stringify({
        challenge: pending.challenge,
        ircNick: pending.nick,
        verified: Boolean(result.verified),
        cserviceUsername: result.username || ""
      })
    });
    const raw = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${raw.slice(0, 180)}`);
    log("cservice_callback_ok", {
      nick: pending.nick,
      challenge: pending.challenge,
      verified: Boolean(result.verified),
      username: result.username || null
    });
  } catch (err) {
    log("cservice_callback_error", {
      nick: pending.nick,
      challenge: pending.challenge,
      error: err?.message || String(err)
    });
  }
}

function handleXVerifyReply(text) {
  const line = safeIrcText(text);
  const subject = line.match(/(?:^|\s)([^\s!]+)!/)?.[1] || "";
  if (!subject) return false;
  const key = subject.toLowerCase();
  const pending = cservicePending.get(key);
  if (!pending) return false;
  if (Date.now() - pending.at > 10 * 60 * 1000) {
    cservicePending.delete(key);
    return true;
  }

  if (/\bis NOT logged in\b/i.test(line)) {
    cservicePending.delete(key);
    send(`NOTICE ${pending.nick} :X says you are not logged into a CService username yet. Log into X, then run !verify ${pending.challenge} again.`);
    reportCserviceResult(pending, { verified: false });
    return true;
  }

  const match = line.match(/\blogged in as\s+([A-Za-z0-9][A-Za-z0-9_.-]{1,31})/i);
  if (!match) return false;
  const username = match[1];
  cservicePending.delete(key);
  send(`NOTICE ${pending.nick} :CService verified as ${username}. Return to Brain Trust; it should unlock automatically.`);
  reportCserviceResult(pending, { verified: true, username });
  return true;
}
function splitForIrc(text) {
  const clean = safeIrcText(text);
  if (!clean) return [];
  const max = Math.max(80, cfg.maxReplyChars);
  const out = [];
  let rest = clean;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(" ", max);
    if (cut < Math.floor(max * 0.55)) {
      cut = max;
    }
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) {
    out.push(rest);
  }
  return out;
}
function parseLine(line) {
  let rest = line;
  let prefix = "";
  if (rest.startsWith(":")) {
    const i = rest.indexOf(" ");
    if (i < 0) return null;
    prefix = rest.slice(1, i);
    rest = rest.slice(i + 1);
  }
  const parts = rest.split(" ");
  const command = parts.shift() || "";
  let trailing = "";
  const ti = parts.findIndex(x => x.startsWith(":"));
  if (ti >= 0) {
    trailing = parts
      .slice(ti)
      .join(" ")
      .replace(/^:/, "");
    parts.length = ti;
  }
  return {
    prefix,
    command,
    params: parts,
    trailing
  };
}
function nickFromPrefix(prefix) {
  return String(prefix || "").split("!")[0];
}
function shouldAnswer(from, target, text) {
  if (!text || !from) return false;
  if (
    nickFromPrefix(from).toLowerCase() ===
    cfg.nick.toLowerCase()
  ) {
    return false;
  }
  if (target.toLowerCase() !== cfg.channel.toLowerCase()) return false;
  const lower = text.toLowerCase();
  const addressed =
    lower.startsWith(cfg.nick.toLowerCase() + ":") ||
    lower.startsWith(cfg.nick.toLowerCase() + ",") ||
    lower.includes(cfg.nick.toLowerCase());
  return addressed || ["killercut_","killercut"].includes(nickFromPrefix(from).toLowerCase());
}
const conversationHistory = [];
const historyFile = path.join(process.cwd(), "data", "conversation-history.json");

function loadConversationHistory() {
  try {
    const saved = JSON.parse(fs.readFileSync(historyFile, "utf8"));
    if (Array.isArray(saved)) {
      conversationHistory.push(
        ...saved
          .filter(turn =>
            turn &&
            typeof turn.role === "string" &&
            typeof turn.text === "string"
          )
          .slice(-24)
      );
    }
    log("history_loaded", { turns: conversationHistory.length });
  } catch (err) {
    if (err?.code !== "ENOENT") {
      log("history_load_error", { error: err.message || String(err) });
    }
  }
}

function saveConversationHistory() {
  try {
    fs.mkdirSync(path.dirname(historyFile), { recursive: true });
    const tmp = historyFile + ".tmp";
    fs.writeFileSync(
      tmp,
      JSON.stringify(conversationHistory, null, 2),
      { mode: 0o600 }
    );
    fs.renameSync(tmp, historyFile);
    fs.chmodSync(historyFile, 0o600);
  } catch (err) {
    log("history_save_error", { error: err.message || String(err) });
  }
}

loadConversationHistory();
saveConversationHistory();

async function askArena(kyleMessage, from) {
  if (replyBusy) {
    log("reply_skipped_busy", { from });
    return;
  }

  const now = Date.now();
  const wait = cfg.minReplyInterval - (now - lastReplyAt);
  if (wait > 0) {
    log("reply_skipped_rate_limit", { waitMs: wait, from });
    return;
  }

  replyBusy = true;
  lastReplyAt = now;

  const roster = [
    { name: "PrincessGPT", provider: "openai", reasoning: "medium", fallbacks: ["gemini"] },
    { name: "GemmyAI", provider: "gemini", reasoning: "low", fallbacks: ["openai"] },
    { name: "ClaudeAI", provider: "anthropic", reasoning: "medium", fallbacks: ["gemini", "openai"] },
    { name: "DeepSeekAI", provider: "deepseek", reasoning: "medium", fallbacks: ["gemini", "openai"] },
    { name: "MistralAI", provider: "mistral", reasoning: "low", fallbacks: ["gemini", "openai"] },
    { name: "RouterAI", provider: "openrouter", reasoning: "medium", fallbacks: ["gemini", "openai"] }
  ];

  try {
    const recentConversation = conversationHistory
      .slice(-20)
      .map(turn => `${turn.role}: ${turn.text}`)
      .join("\n");

    const instructions = [
      "This is Kyle's AI tournament room.",
      "PrincessGPT is the only IRC nick; she is the host and mouthpiece for all contestants.",
      "Several AI contestants improve one answer sequentially.",
      "The first contestant gives a compact useful baseline.",
      "Later contestants must materially improve the existing answer or return PASS exactly.",
      "Never repeat, praise, or paraphrase an existing answer just to speak.",
      "A valid improvement corrects an error, adds an important missing fact, catches an edge case, or gives a substantially better method.",
      "Keep IRC replies compact and natural.",
      "Pay attention to nicknames and recent context.",
      "Do not invent facts."
    ].join(" ");

    let roundTranscript = "";
    let consecutivePasses = 0;
    let visibleReplies = 0;

    for (const contestant of roster) {
      const body = {
        provider: contestant.provider,
        name: contestant.name,
        mode: "tournament",
        challenge:
          `${instructions}\n\n` +
          `Recent conversation:\n${recentConversation || "(none)"}\n\n` +
          `Newest human message:\n${from}: ${kyleMessage}\n\n` +
          `AI answers already given in THIS round:\n${roundTranscript || "(none yet)"}\n\n` +
          `${contestant.name}:`,
        images: [],
        reasoning: contestant.reasoning,
        hint: "",
        used: []
      };

      try {
        const providers = [contestant.provider, ...(contestant.fallbacks || [])];
        let data = {};
        let usedProvider = contestant.provider;
        let lastError = null;

        for (const providerName of providers) {
          const tryBody = { ...body, provider: providerName };
          const r = await fetch(`${cfg.arena}/api/relay-contestant`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${cfg.relayKey}`
            },
            body: JSON.stringify(tryBody)
          });

          const raw = await r.text();
          let parsed = {};
          try { parsed = JSON.parse(raw); } catch {}

          if (r.ok) {
            data = parsed;
            usedProvider = providerName;
            if (providerName !== contestant.provider) {
              log("contestant_fallback", {
                persona: contestant.name,
                primary: contestant.provider,
                fallback: providerName
              });
            }
            lastError = null;
            break;
          }

          lastError = {
            status: r.status,
            error: String(parsed.error || raw).slice(0, 220),
            provider: providerName
          };

          log("contestant_provider_failed", {
            persona: contestant.name,
            provider: providerName,
            status: r.status,
            error: lastError.error
          });
        }

        if (lastError) {
          log("contestant_skipped_error", {
            persona: contestant.name,
            provider: contestant.provider,
            status: lastError.status,
            error: lastError.error
          });
          continue;
        }

        const answer = String(data.guess || data.answer || data.reply || "").trim();

        if (!answer || /^PASS[.!]?$/i.test(answer)) {
          consecutivePasses += 1;
          log("tournament_pass", {
            persona: contestant.name,
            provider: data.provider || usedProvider,
            model: data.model
          });

          if (consecutivePasses >= 2 && visibleReplies > 0) {
            log("tournament_early_stop", {
              visibleReplies,
              reason: "two_consecutive_passes"
            });
            break;
          }
          continue;
        }

        consecutivePasses = 0;
        visibleReplies += 1;

        roundTranscript +=
          (roundTranscript ? "\n" : "") +
          `${contestant.name}: ${answer}`;

        conversationHistory.push({
          role: contestant.name,
          text: answer
        });

        if (conversationHistory.length > 30) {
          conversationHistory.splice(
            0,
            conversationHistory.length - 30
          );
        }

        saveConversationHistory();

        for (const part of splitForIrc(answer)) {
          send(
            `PRIVMSG ${cfg.channel} :[${contestant.name}] ${part}`
          );
        }

        log("tournament_reply", {
          from,
          persona: contestant.name,
          provider: data.provider || usedProvider,
          model: data.model,
          latency: data.latency,
          chars: answer.length
        });

        await new Promise(resolve => setTimeout(resolve, 900));
      } catch (err) {
        log("contestant_skipped_error", {
          persona: contestant.name,
          provider: contestant.provider,
          error: err?.message || String(err)
        });
      }
    }

    log("tournament_complete", {
      from,
      visibleReplies
    });
  } catch (err) {
    log("arena_error", {
      error: err?.message || String(err)
    });
  } finally {
    replyBusy = false;
  }
}
function handle(line) {
  const msg = parseLine(line);
  if (!msg) return;
  log("irc_in", { line });
  if ((msg.command === "NOTICE" || msg.command === "PRIVMSG") && isXPrefix(msg.prefix)) {
    if (handleXVerifyReply(msg.trailing || "")) return;
  }
  if (msg.command === "PING") {
    const token =
      msg.trailing ||
      msg.params[0] ||
      "";
    send(`PONG :${token}`);
    return;
  }
  if (
    msg.command === "001" ||
    msg.command === "376" ||
    msg.command === "422"
  ) {
    if (cfg.username && cfg.password) {
      send(
        `PRIVMSG X@channels.undernet.org :LOGIN ${cfg.username} ${cfg.password}`
      );
    }
    if (
      msg.command === "376" ||
      msg.command === "422"
    ) {
      setTimeout(
        () => send(cfg.channelKey ? `JOIN ${cfg.channel} ${cfg.channelKey}` : `JOIN ${cfg.channel}`),
        500
      );
    }
    return;
  }
  if (
    msg.command === "366" &&
    String(msg.params?.[1] || msg.params?.[0] || "").toLowerCase() === cfg.channel.toLowerCase()
  ) {
    if (cfg.enforceModes && cfg.channelKey) {
      if (cfg.username && cfg.password) {
        send(`PRIVMSG X@channels.undernet.org :OP ${cfg.channel} ${cfg.nick}`);
      }
      setTimeout(() => {
        send(`MODE ${cfg.channel} +ntsk ${cfg.channelKey}`);
      }, 1600);
    }
    return;
  }
  if (msg.command === "433") {
    log("nick_in_use", {
      nick: cfg.nick
    });
    shuttingDown = true;
    try {
      socket?.destroy();
    } catch {}
    return;
  }
  if (msg.command === "PRIVMSG") {
    const target =
      msg.params[0] || "";
    const text =
      msg.trailing || "";

    const speaker = nickFromPrefix(msg.prefix);
    const verifyMatch = String(text || "").trim().match(/^!verify\s+([a-f0-9]{10})$/i);
    if (verifyMatch && target.toLowerCase() === cfg.channel.toLowerCase()) {
      const challenge = verifyMatch[1].toLowerCase();
      cservicePending.set(speaker.toLowerCase(), { challenge, nick: speaker, at: Date.now() });
      send(`NOTICE ${speaker} :Checking your logged-in CService identity with X…`);
      send(`PRIVMSG X@channels.undernet.org :VERIFY ${speaker}`);
      log("cservice_verify_requested", { nick: speaker, challenge });
      return;
    }

    if (
      text &&
      target.toLowerCase() === cfg.channel.toLowerCase() &&
      speaker.toLowerCase() !== cfg.nick.toLowerCase()
    ) {
      conversationHistory.push({
        role: speaker,
        text
      });

      if (conversationHistory.length > 24) {
        conversationHistory.splice(
          0,
          conversationHistory.length - 24
        );
      }

      saveConversationHistory();
    }

    if (shouldAnswer(
      msg.prefix,
      target,
      text
    )) {
      const from =
        nickFromPrefix(msg.prefix);
      const cleaned =
        text
          .replace(
            new RegExp(
              `^${cfg.nick}[,:]\\s*`,
              "i"
            ),
            ""
          )
          .trim();
      const delay = tournamentDelayMs();

      log("tournament_scheduled", {
        from,
        persona: cfg.persona,
        delayMs: delay
      });

      setTimeout(
        () => askArena(cleaned, from),
        delay
      );
    }
  }
}
function connect() {
  if (shuttingDown) return;
  log("connecting", {
    server: cfg.server,
    port: cfg.port,
    nick: cfg.nick,
    channel: cfg.channel,
    enabled: cfg.enabled
  });
  socket = net.createConnection({
    host: cfg.server,
    port: cfg.port,
    localAddress: cfg.localAddress
  });
  socket.setEncoding("utf8");
  socket.on("connect", () => {
    log("connected");
    send(`NICK ${cfg.nick}`);
    send(
      `USER ${cfg.user} 0 * :${safeIrcText(cfg.realname)}`
    );
  });
  socket.on("data", chunk => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf("\r\n")) >= 0) {
      const line =
        buffer.slice(0, i);
      buffer =
        buffer.slice(i + 2);
      if (line) {
        handle(line);
      }
    }
  });
  socket.on("error", err => {
    log("socket_error", {
      error: err.message || String(err)
    });
  });
  socket.on("close", () => {
    log("disconnected");
    socket = null;
    if (!shuttingDown) {
      log("restarting_for_failover", { delay: cfg.reconnectDelay });
      setTimeout(() => process.exit(75), cfg.reconnectDelay);
    }
  });
}
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("shutdown", {
    signal
  });
  clearTimeout(reconnectTimer);
  try {
    socket?.end(
      "QUIT :PrincessGPT relay shutting down\r\n"
    );
  } catch {}
  setTimeout(
    () => process.exit(0),
    500
  );
}
process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);
process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);
try {
  requireConfig();
  if (!cfg.enabled) {
    log("disabled", {
      message:
        "Relay is built but disabled. " +
        "Set IRC_ENABLED=1 only when ready " +
        "for a controlled Undernet test."
    });
    process.exit(0);
  }
  connect();
} catch (err) {
  log("configuration_error", {
    error:
      err.message ||
      String(err)
  });
  process.exit(1);
}

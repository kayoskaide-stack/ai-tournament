import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const fold = value => String(value || "").toLowerCase().replace(/[\[\]\\^]/g, c => ({"[":"{", "]":"}", "\\":"|", "^":"~"}[c]));
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const TTL = 15 * 60 * 1000;

// The relay owns verification state. Vercel instances never trust a browser's
// claimed account or keep the only copy of a verification in process memory.
export function createIdentityGate({ send, nick, file, now = Date.now }) {
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

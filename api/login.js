import { loginUser, setSessionCookie, audit } from "./_auth.js";

const failed = new Map();

function blocked(key) {
  const row = failed.get(key);
  if (!row) return false;
  if (Date.now() - row.at > 5 * 60 * 1000) {
    failed.delete(key);
    return false;
  }
  return row.count >= 8;
}
function noteFailure(key) {
  const row = failed.get(key) || { count: 0, at: Date.now() };
  row.count += 1;
  row.at = Date.now();
  failed.set(key, row);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ip = String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  if (blocked(ip)) return res.status(429).json({ error: "Too many failed logins. Try again in a few minutes." });

  const nick = String(req.body?.nick || "").trim();
  const code = String(req.body?.code || "");
  if (!nick || !code) return res.status(400).json({ error: "Nickname and access code are required." });

  try {
    const result = loginUser(nick, code);
    if (!result) {
      noteFailure(ip);
      audit("login_denied", null, { nick, ip });
      return res.status(401).json({ error: "Nickname or access code rejected." });
    }
    failed.delete(ip);
    setSessionCookie(res, result.token, result.maxAge);
    audit("login_success", result.user, { ip });
    return res.status(200).json({ ok: true, user: result.user });
  } catch (e) {
    return res.status(503).json({ error: e?.message || String(e) });
  }
}

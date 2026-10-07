
import {
  loginUser,
  loginPasswordless,
  createMagicLinkToken,
  readMagicLinkToken,
  setSessionCookie,
  clearSessionCookie,
  sessionSummary,
  audit
} from "../lib/braintrust-auth.js";

const failed = new Map();
const magicRequests = new Map();

function blocked(key) {
  const row = failed.get(key);
  if (!row) return false;
  if (Date.now() - row.at > 5 * 60 * 1000) { failed.delete(key); return false; }
  return row.count >= 8;
}
function noteFailure(key) {
  const row = failed.get(key) || { count: 0, at: Date.now() };
  row.count++; row.at = Date.now(); failed.set(key, row);
}
function ipOf(req) {
  return String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}
function magicRateLimited(ip) {
  const now = Date.now();
  const row = magicRequests.get(ip) || { start: now, count: 0 };
  if (now - row.start > 10 * 60 * 1000) { row.start = now; row.count = 0; }
  row.count++; magicRequests.set(ip, row);
  return row.count > 6;
}
function publicBaseUrl() {
  const explicit = String(process.env.BRAINTRUST_PUBLIC_URL || "").trim().replace(/\/+$/, "");
  if (explicit) {
    const u = new URL(explicit);
    if (u.protocol !== "https:") throw new Error("BRAINTRUST_PUBLIC_URL must use https.");
    return u.origin;
  }
  const vercel = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (vercel) return `https://${vercel}`;
  throw new Error("BRAINTRUST_PUBLIC_URL is not configured.");
}
async function sendMagicEmail(to, link) {
  const key = String(process.env.RESEND_API_KEY || "");
  const from = String(process.env.BRAINTRUST_EMAIL_FROM || "");
  if (!key || !from) throw new Error("RESEND_API_KEY / BRAINTRUST_EMAIL_FROM not configured.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to,
      subject: "Your Brain Trust sign-in link",
      html: `<p>Open this private Brain Trust sign-in link:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`
    })
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const action = String(req.query?.action || "").toLowerCase();

  if (action === "session") {
    if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
    const summary = sessionSummary(req);
    return res.status(summary.authenticated ? 200 : 401).json(summary);
  }
  if (action === "logout") {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
  if (action === "request-link") {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const ip = ipOf(req);
    if (magicRateLimited(ip)) return res.status(429).json({ error: "Too many sign-in link requests. Try again shortly." });

    const email = String(req.body?.email || "").trim().toLowerCase();
    const nick = String(req.body?.nick || "").trim();
    const cservice = String(req.body?.cserviceUsername || "").trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Valid email required." });
    if (cservice && !/^[A-Za-z0-9_\-\[\]\\`^{}|]{1,32}$/.test(cservice)) return res.status(400).json({ error: "Invalid CService username format." });

    const token = createMagicLinkToken({ email, nick, cservice });
    if (token) {
      const link = `${publicBaseUrl()}/api/auth?action=verify&token=${encodeURIComponent(token)}`;
      await sendMagicEmail(email, link);
      audit("magic_link_sent", null, { ip, emailHint: email.replace(/(^.).*(@.*$)/, "$1***$2") });
    }
    return res.status(200).json({ ok: true, message: "If that email is authorized, a private sign-in link has been sent." });
  }
  if (action === "verify") {
    if (req.method !== "GET") return res.status(405).send("GET only");
    const payload = readMagicLinkToken(req.query?.token);
    const result = payload ? loginPasswordless(payload) : null;
    if (!result) return res.status(400).send("Invalid, expired, or unauthorized Brain Trust sign-in link.");
    setSessionCookie(res, result.token, result.maxAge);
    audit("magic_login_success", result.user, { cservice: result.user.cservice || "" });
    res.statusCode = 302;
    res.setHeader("Location", "/");
    return res.end();
  }

  if (action !== "login") return res.status(400).json({ error: "Unknown authentication action." });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ip = ipOf(req);
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

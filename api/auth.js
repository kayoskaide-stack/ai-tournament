import { identityBridge } from "../lib/identity-bridge.js";

import {
  readOnboarding,
  completeOnboarding,
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
      subject: "Confirm your email for Kyle’s Brain Trust",
      text: `Confirm your email: ${link}\nThis link expires in 15 minutes. Guests must then verify their Undernet CService/X account before entering chat. Brain Trust never asks for your X password.`,
      html: `<html lang="en"><body style="font:16px system-ui;line-height:1.5"><h1>Kyle’s Brain Trust</h1><p>Confirm your email to continue:</p><p><a style="display:inline-block;padding:14px 20px;background:#163a58;color:#fff;border-radius:6px" href="${link.replace(/&/g,"&amp;")}">CONFIRM MY EMAIL</a></p><p>This link expires in 15 minutes. Next, guests must verify their Undernet CService/X account before entering chat. We never ask for your X password.</p></body></html>`
    })
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const action = String(req.query?.action || "").toLowerCase();
  if (req.method === "POST" && req.headers?.origin) {
    try {
      if (new URL(req.headers.origin).host !== String(req.headers["x-forwarded-host"] || req.headers.host || "")) return res.status(403).json({ error: "Cross-origin request rejected." });
    } catch { return res.status(403).json({ error: "Cross-origin request rejected." }); }
  }
  try {
  if (["identity-start", "identity-status"].includes(action)) {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const user = readOnboarding(req);
    if (!user?.emailVerified) return res.status(403).json({ error: "Confirm your email before verifying CService." });
    const binding = `${user.id}:${user.rev}:${user.flow}`;
    if (action === "identity-start") {
      const data = await identityBridge("start", { binding });
      return res.status(200).json(data);
    }
    const proof = await identityBridge("status", { binding, challenge: String(req.body?.challenge || "") });
    const result = completeOnboarding(user, proof);
    if (result) {
      setSessionCookie(res, result.token, result.maxAge);
      audit("verified_member_admitted", result.user);
      return res.status(200).json({ ok: true, verified: true });
    }
    return res.status(200).json({ ok: true, verified: false, message: "Waiting for a private verification message from your X-authenticated IRC nickname." });
  }

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

    const pending = readOnboarding(req);
    const invite = pending && !pending.id.startsWith("email:") ? { id: pending.id, rev: pending.rev, flow: pending.flow } : undefined;
    // Invite holders may confirm their own email without a separate environment allowlist.
    // Preserve owner email login; guests must present an invite first.
    const ownerEmail = String(process.env.BRAINTRUST_OWNER_EMAIL || "").trim().toLowerCase();
    const token = (invite || email === ownerEmail) ? createMagicLinkToken({ email, nick, cservice, invite }) : null;
    if (token) {
      const link = `${publicBaseUrl()}/api/auth?action=verify&token=${encodeURIComponent(token)}`;
      await sendMagicEmail(email, link);
      audit("magic_link_sent", null, { ip, emailHint: email.replace(/(^.).*(@.*$)/, "$1***$2") });
    }
    return res.status(200).json({ ok: true, message: "If that email is authorized, a private sign-in link has been sent." });
  }
  if (action === "verify") {
    if (!["GET", "POST"].includes(req.method)) return res.status(405).send("GET or POST only");
    const rawToken = req.method === "POST" ? req.body?.token : req.query?.token;
    const payload = readMagicLinkToken(rawToken);
    if (!payload) return res.status(400).send("Invalid, expired, or unauthorized confirmation link. Return to Brain Trust and request a new one.");
    // Email scanners may follow GET links. Consume only on an explicit form POST.
    if (req.method === "GET") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
      return res.status(200).send(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm Brain Trust email</title><body style="background:#071019;color:#d9e3ea;font:18px system-ui;padding:24px"><h1>Kyle’s Brain Trust</h1><p>Confirm your email to continue registration.</p><form method="post" action="/api/auth?action=verify"><input type="hidden" name="token" value="${String(rawToken).replace(/[^A-Za-z0-9_.-]/g, "")}"><button style="min-height:48px;padding:12px 24px;font:inherit">CONFIRM MY EMAIL</button></form><p>Guests must then verify their CService/X account before entering chat.</p></body></html>`);
    }
    if (payload?.invite) await identityBridge("consume-email", { nonce: payload.nonce, expires: payload.exp });
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
    return res.status(200).json({ ok: true, onboarding: result.onboarding === true, user: result.user });
  } catch (e) {
    return res.status(503).json({ error: e?.message || String(e) });
  }
  } catch (e) {
    console.error("onboarding_unavailable", e?.message);
    return res.status(503).json({ error: "Registration service unavailable. Chat remains locked; please try again shortly." });
  }
}

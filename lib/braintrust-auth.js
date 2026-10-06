import crypto from "node:crypto";
import USERS_REGISTRY from "../security/users.js";
import POLICY from "../security/policy.js";

const COOKIE = "bt_session";
const SESSION_DAYS = Math.max(1, Math.min(90, Number(process.env.BRAINTRUST_SESSION_DAYS || 30)));

const ROLE_CAPS = {
  owner: ["chat","view_funds","propose","preview","approve","reject","rollback","manage_users","manage_security"],
  maintainer: ["chat","propose","preview"],
  member: ["chat"]
};

const buckets = new Map();

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function safeEqual(a, b) {
  const A = Buffer.from(String(a || ""), "utf8");
  const B = Buffer.from(String(b || ""), "utf8");
  return A.length > 0 && A.length === B.length && crypto.timingSafeEqual(A, B);
}

function sessionSecret() {
  const direct = String(process.env.BRAINTRUST_SESSION_SECRET || "");
  if (direct.length >= 32) return direct;
  const admin = String(process.env.ARENA_ADMIN_KEY || "");
  if (admin.length >= 16) {
    return crypto.createHash("sha256").update(`braintrust-session:${admin}`).digest("hex");
  }
  return "";
}

function listUsers() {
  return Array.isArray(USERS_REGISTRY?.users) ? USERS_REGISTRY.users : [];
}

function userById(id) {
  return listUsers().find(u => String(u?.id || "") === String(id || "")) || null;
}

function userByNick(nick) {
  const low = String(nick || "").trim().toLowerCase();
  return listUsers().find(u => String(u?.nick || "").trim().toLowerCase() === low) || null;
}

function publicUser(u) {
  if (!u) return null;
  const role = ["owner","maintainer","member"].includes(String(u.role || "").toLowerCase())
    ? String(u.role).toLowerCase()
    : "member";
  const caps = new Set([...(ROLE_CAPS[role] || []), ...(Array.isArray(u.capabilities) ? u.capabilities : [])]);
  return {
    id: String(u.id || ""),
    nick: String(u.nick || ""),
    role,
    capabilities: [...caps],
    rev: Number(u.rev || 1)
  };
}

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload) {
  const secret = sessionSecret();
  if (!secret) throw new Error("Brain Trust session signing secret is unavailable.");
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token) {
  const secret = sessionSecret();
  if (!secret) return null;
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload?.id || !payload?.exp || Date.now() >= Number(payload.exp)) return null;

  if (payload.kind === "cservice") {
    const nick = String(payload.nick || "").trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{1,31}$/.test(nick)) return null;
    return {
      id: `cservice:${nick.toLowerCase()}`,
      nick,
      role: "member",
      capabilities: [...ROLE_CAPS.member],
      rev: 1,
      source: "cservice"
    };
  }

  const stored = userById(payload.id);
  if (!stored || stored.active === false) return null;
  if (Number(stored.rev || 1) !== Number(payload.rev || 1)) return null;

  return publicUser(stored);
}

function parseCookies(req) {
  const raw = String(req.headers?.cookie || "");
  const out = {};
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function originAllowed(req) {
  const method = String(req.method || "GET").toUpperCase();
  if (!["POST","PUT","PATCH","DELETE"].includes(method)) return true;
  const origin = String(req.headers?.origin || "");
  if (!origin) return true;
  const host = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function relayIdentity(req) {
  const wanted = String(process.env.ARENA_RELAY_KEY || "");
  if (wanted.length < 16) return null;
  const header = String(req.headers?.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const got = header.slice(7).trim();
  if (!safeEqual(got, wanted)) return null;
  return {
    id: "service:irc-relay",
    nick: "PrincessGPT Relay",
    role: "service",
    capabilities: ["chat"],
    rev: 1,
    service: true
  };
}

function checkRate(user, capability) {
  if (!user || user.service) return true;
  const now = Date.now();
  const limits = { owner: 120, maintainer: 60, member: 30 };
  const limit = capability === "chat" ? (limits[user.role] || 20) : 30;
  const key = `${user.id}:${capability}`;
  const row = buckets.get(key) || { start: now, count: 0 };
  if (now - row.start >= 60000) {
    row.start = now;
    row.count = 0;
  }
  row.count += 1;
  buckets.set(key, row);
  return row.count <= limit;
}

export function authenticateRequest(req, { allowRelay = false } = {}) {
  if (allowRelay) {
    const relay = relayIdentity(req);
    if (relay) return relay;
  }
  const token = parseCookies(req)[COOKIE] || "";
  return verifyToken(token);
}

export function requireAccess(req, res, capability = "chat", { allowRelay = false } = {}) {
  if (!originAllowed(req)) {
    res.status(403).json({ error: "Cross-origin request rejected." });
    return null;
  }

  const user = authenticateRequest(req, { allowRelay });
  if (!user) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }

  if (POLICY?.frozen && !["manage_security","rollback"].includes(capability)) {
    res.status(423).json({
      error: `Brain Trust is in emergency lockdown${POLICY.reason ? `: ${POLICY.reason}` : "."}`
    });
    return null;
  }

  if (capability && !user.capabilities.includes(capability)) {
    res.status(403).json({ error: `Permission denied: ${capability}` });
    return null;
  }

  if (!checkRate(user, capability)) {
    res.status(429).json({ error: "Per-user request rate limit reached. Try again shortly." });
    return null;
  }

  return user;
}

export function loginUser(nick, code) {
  const stored = userByNick(nick);
  if (!stored || stored.active === false || !stored.codeSha256) return null;

  const got = sha256(String(code || ""));
  if (!safeEqual(got, String(stored.codeSha256 || "").toLowerCase())) return null;

  const user = publicUser(stored);
  const now = Date.now();
  const payload = {
    v: 1,
    id: user.id,
    rev: user.rev,
    iat: now,
    exp: now + SESSION_DAYS * 24 * 60 * 60 * 1000
  };

  return {
    token: signPayload(payload),
    user,
    maxAge: SESSION_DAYS * 24 * 60 * 60
  };
}

export function loginCserviceUser(nick) {
  const clean = String(nick || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{1,31}$/.test(clean))
    throw new Error("Invalid CService username returned by X.");

  const now = Date.now();
  const user = {
    id: `cservice:${clean.toLowerCase()}`,
    nick: clean,
    role: "member",
    capabilities: [...ROLE_CAPS.member],
    rev: 1,
    source: "cservice"
  };
  const payload = {
    v: 1,
    kind: "cservice",
    id: user.id,
    nick: clean,
    role: "member",
    rev: 1,
    iat: now,
    exp: now + SESSION_DAYS * 24 * 60 * 60 * 1000
  };
  return {
    token: signPayload(payload),
    user,
    maxAge: SESSION_DAYS * 24 * 60 * 60
  };
}

export function setSessionCookie(res, token, maxAge) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(0, Number(maxAge || 0))}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  );
}

export function sessionSummary(req) {
  const user = authenticateRequest(req);
  return { authenticated: Boolean(user), user: user || null, frozen: Boolean(POLICY?.frozen) };
}

export function audit(action, user, extra = {}) {
  console.log(JSON.stringify({
    event: "braintrust_audit",
    ts: new Date().toISOString(),
    action,
    actor: user ? { id: user.id, nick: user.nick, role: user.role } : null,
    ...extra
  }));
}

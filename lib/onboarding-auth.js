import crypto from "node:crypto";

const EMAIL_COOKIE = "bt_email_ok";
const EMAIL_MAX_AGE = 60 * 60;

function safeEqual(a, b) {
  const A = Buffer.from(String(a || ""), "utf8");
  const B = Buffer.from(String(b || ""), "utf8");
  return A.length > 0 && A.length === B.length && crypto.timingSafeEqual(A, B);
}

function secret() {
  const direct = String(process.env.BRAINTRUST_ONBOARDING_SECRET || process.env.BRAINTRUST_SESSION_SECRET || "");
  if (direct.length >= 32) return direct;
  const admin = String(process.env.ARENA_ADMIN_KEY || "");
  if (admin.length >= 16) return crypto.createHash("sha256").update(`braintrust-onboarding:${admin}`).digest("hex");
  return "";
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

function appendCookie(res, value) {
  const existing = res.getHeader?.("Set-Cookie");
  if (!existing) return res.setHeader("Set-Cookie", value);
  const list = Array.isArray(existing) ? existing : [existing];
  res.setHeader("Set-Cookie", [...list, value]);
}

function sign(payload) {
  const key = secret();
  if (!key) throw new Error("Brain Trust onboarding signing secret is unavailable.");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token) {
  const key = secret();
  if (!key) return null;
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", key).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload?.kind !== "email" || !payload.emailHash || !payload.exp || Date.now() >= Number(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function emailHash(email) {
  return crypto.createHash("sha256").update(String(email || "").trim().toLowerCase()).digest("hex");
}

export function setEmailVerifiedCookie(res, email, maxAge = EMAIL_MAX_AGE) {
  const now = Date.now();
  const seconds = Math.max(300, Math.min(24 * 60 * 60, Number(maxAge || EMAIL_MAX_AGE)));
  const token = sign({
    v: 1,
    kind: "email",
    emailHash: emailHash(email),
    iat: now,
    exp: now + seconds * 1000
  });
  appendCookie(res, `${EMAIL_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`);
  return { emailHash: emailHash(email), maxAge: seconds };
}

export function readEmailVerified(req) {
  return verify(parseCookies(req)[EMAIL_COOKIE] || "");
}

export function clearEmailVerifiedCookie(res) {
  appendCookie(res, `${EMAIL_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

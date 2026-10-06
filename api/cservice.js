import crypto from "node:crypto";
import { put, get, del } from "@vercel/blob";
import { readEmailVerified, clearEmailVerifiedCookie } from "../lib/onboarding-auth.js";
import { loginCserviceUser, setSessionCookie, audit } from "../lib/braintrust-auth.js";

const TTL_MS = 15 * 60 * 1000;
const CODE_RE = /^[a-f0-9]{10}$/;

function pathFor(code) {
  return `braintrust/cservice/${code}.json`;
}

function safeEqual(a, b) {
  const A = Buffer.from(String(a || ""), "utf8");
  const B = Buffer.from(String(b || ""), "utf8");
  return A.length > 0 && A.length === B.length && crypto.timingSafeEqual(A, B);
}

function relayAuthorized(req) {
  const wanted = String(process.env.ARENA_RELAY_KEY || "");
  const header = String(req.headers?.authorization || "");
  const got = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  return wanted.length >= 16 && safeEqual(got, wanted);
}

async function readRecord(code) {
  if (!CODE_RE.test(code)) return null;
  const found = await get(pathFor(code), { access: "private", useCache: false });
  if (!found || found.statusCode !== 200) return null;
  const raw = await new Response(found.stream).text();
  try { return JSON.parse(raw); } catch { return null; }
}

async function writeRecord(row) {
  await put(pathFor(row.code), JSON.stringify(row), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    cacheControlMaxAge: 60
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const action = String(req.query?.action || "").toLowerCase();

  try {
    if (action === "relay-verify") {
      if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
      if (!relayAuthorized(req)) return res.status(401).json({ error: "Relay authorization rejected." });

      const code = String(req.body?.challenge || "").trim().toLowerCase();
      const row = await readRecord(code);
      if (!row) return res.status(404).json({ error: "Verification challenge not found." });
      if (Date.now() >= Number(row.expiresAt || 0)) return res.status(410).json({ error: "Verification challenge expired." });

      const verified = req.body?.verified === true;
      const username = String(req.body?.cserviceUsername || "").trim();
      row.ircNick = String(req.body?.ircNick || "").trim().slice(0, 64);
      row.updatedAt = Date.now();
      if (verified && /^[A-Za-z0-9][A-Za-z0-9_.-]{1,31}$/.test(username)) {
        row.status = "verified";
        row.cserviceUsername = username;
        row.verifiedAt = Date.now();
        row.message = "CService identity verified by X.";
      } else {
        row.status = "not_logged_in";
        row.message = "X says this IRC nickname is not logged into a CService account yet.";
      }
      await writeRecord(row);
      audit("cservice_relay_result", null, { challenge: code, status: row.status, ircNick: row.ircNick, cserviceUsername: row.cserviceUsername || null });
      return res.status(200).json({ ok: true, status: row.status });
    }

    const emailProof = readEmailVerified(req);
    if (!emailProof) return res.status(401).json({ error: "Email confirmation is required before the Undernet identity check." });

    if (action === "challenge") {
      if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
      const code = crypto.randomBytes(5).toString("hex");
      const now = Date.now();
      const row = {
        v: 1,
        code,
        emailHash: emailProof.emailHash,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        expiresAt: now + TTL_MS
      };
      await writeRecord(row);
      audit("cservice_challenge_created", null, { challenge: code });
      return res.status(200).json({
        ok: true,
        challenge: code,
        command: `!verify ${code}`,
        expiresIn: Math.floor(TTL_MS / 1000),
        channel: "#ai-tournament",
        cservice: "https://cservice.undernet.org/"
      });
    }

    if (action === "status") {
      if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
      const code = String(req.query?.challenge || "").trim().toLowerCase();
      const row = await readRecord(code);
      if (!row || !safeEqual(row.emailHash, emailProof.emailHash)) return res.status(404).json({ error: "Verification challenge not found." });
      if (Date.now() >= Number(row.expiresAt || 0)) {
        await del(pathFor(code)).catch(() => {});
        return res.status(410).json({ error: "Verification challenge expired. Create a new one." });
      }

      if (row.status === "verified" && row.cserviceUsername) {
        const login = loginCserviceUser(row.cserviceUsername);
        setSessionCookie(res, login.token, login.maxAge);
        clearEmailVerifiedCookie(res);
        await del(pathFor(code)).catch(() => {});
        audit("cservice_member_admitted", login.user, { challenge: code, ircNick: row.ircNick || null });
        return res.status(200).json({ ok: true, verified: true, username: row.cserviceUsername, redirect: "/" });
      }

      return res.status(200).json({
        ok: true,
        verified: false,
        status: row.status || "pending",
        message: row.message || "Waiting for X to verify your logged-in IRC nickname."
      });
    }

    return res.status(400).json({ error: "Unknown CService action." });
  } catch (e) {
    console.error("cservice_error", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}

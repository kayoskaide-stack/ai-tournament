import crypto from "node:crypto";
import contestantHandler from "./contestant.js";

function providedRelayKey(req) {
  const header = String(req.headers?.authorization || "");

  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function keysMatch(provided, expected) {
  const a = Buffer.from(String(provided || ""), "utf8");
  const b = Buffer.from(String(expected || ""), "utf8");

  return (
    a.length > 0 &&
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  const expected = String(process.env.ARENA_RELAY_KEY || "");

  if (expected.length < 16) {
    return res
      .status(503)
      .json({ error: "Relay authentication is not configured." });
  }

  const provided = providedRelayKey(req);

  if (!keysMatch(provided, expected)) {
    return res.status(401).json({ error: "Unauthorized relay." });
  }

  return contestantHandler(req, res);
}

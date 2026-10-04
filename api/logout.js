import { clearSessionCookie } from "./_auth.js";
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}

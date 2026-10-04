import { sessionSummary } from "./_auth.js";
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const summary = sessionSummary(req);
  return res.status(summary.authenticated ? 200 : 401).json(summary);
}

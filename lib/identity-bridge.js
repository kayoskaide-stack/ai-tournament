export async function identityBridge(action, body) {
  const base = String(process.env.BRAINTRUST_RELAY_BASE_URL || "").replace(/\/+$/, "");
  const token = String(process.env.BRAINTRUST_RELAY_TOKEN || "");
  if (!base.startsWith("https://") || token.length < 16) throw Error("Identity verification relay is unavailable. Chat remains locked.");
  const response = await fetch(`${base}/identity/${action}`, {
    method: "POST", signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw Error("Identity verification is unavailable or expired. Chat remains locked.");
  return response.json();
}

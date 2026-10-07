import { audit } from "./braintrust-auth.js";

const VALID_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024"]);
const VALID_QUALITY = new Set(["low", "medium", "high"]);

function boundedInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function openAIImageRequest(body) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  return { response, data, raw };
}

export default async function imageGeneration(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) {
    return res.status(400).json({ error: "Image prompt is required." });
  }
  if (prompt.length > 4000) {
    return res.status(400).json({ error: "Image prompt is too long." });
  }

  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) {
    return res.status(503).json({ error: "OPENAI_API_KEY is not configured." });
  }

  const model = String(process.env.BRAINTRUST_IMAGE_MODEL || "gpt-image-2").trim();
  const requestedSize = String(req.body?.size || "1024x1024").trim();
  const size = VALID_SIZES.has(requestedSize) ? requestedSize : "1024x1024";

  const requestedQuality = String(
    req.body?.quality || process.env.BRAINTRUST_IMAGE_QUALITY || "low"
  ).trim().toLowerCase();
  const quality = VALID_QUALITY.has(requestedQuality) ? requestedQuality : "low";

  const compression = boundedInt(
    process.env.BRAINTRUST_IMAGE_COMPRESSION,
    72,
    20,
    95
  );

  try {
    const primaryBody = {
      model,
      prompt,
      size,
      quality,
      output_format: "jpeg",
      output_compression: compression
    };

    let result = await openAIImageRequest(primaryBody);

    // Compatibility fallback: keep image generation working even if a model
    // rejects one of the optional output controls.
    if (!result.response.ok && result.response.status === 400) {
      result = await openAIImageRequest({
        model,
        prompt,
        size,
        quality
      });
    }

    if (!result.response.ok) {
      const message =
        result.data?.error?.message ||
        result.data?.error ||
        result.raw ||
        `OpenAI image HTTP ${result.response.status}`;

      return res
        .status(result.response.status >= 500 ? 502 : result.response.status)
        .json({ error: String(message).slice(0, 1200) });
    }

    const item = result.data?.data?.[0] || {};
    const b64 = String(item.b64_json || "");
    const url = String(item.url || "");

    if (!b64 && !url) {
      return res.status(502).json({ error: "Image provider returned no image." });
    }

    const format =
      String(result.data?.output_format || item.output_format || "")
        .trim()
        .toLowerCase() ||
      (url ? "url" : "jpeg");

    const mime =
      format === "png"
        ? "image/png"
        : format === "webp"
          ? "image/webp"
          : "image/jpeg";

    const image = b64 ? `data:${mime};base64,${b64}` : url;

    audit("image_generated", req.braintrustUser, {
      provider: "openai",
      model,
      size,
      quality,
      promptChars: prompt.length
    });

    return res.status(200).json({
      ok: true,
      provider: "openai",
      model,
      size,
      quality,
      format,
      image,
      revisedPrompt: String(item.revised_prompt || "")
    });
  } catch (error) {
    return res.status(502).json({
      error: String(error?.message || error).slice(0, 1200)
    });
  }
}

let deepSeekNativeBlockedUntil = 0;
let mistralNativeBlockedUntil = 0;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function parseJson(raw) {
  try { return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}

function messageFrom(data, raw, status) {
  return String(
    data?.error?.message ||
    data?.error ||
    data?.message ||
    raw ||
    `HTTP ${status}`
  );
}

function makeError(provider, model, status, message) {
  const e = new Error(`${provider} ${model} failed (HTTP ${status}): ${message}`);
  e.status = Number(status) || 500;
  e.provider = provider;
  e.model = model;
  return e;
}

function statusForError(e) {
  const status = Number(e?.status || 0);
  if (status === 402 || status === 429) return status;
  if (status === 401 || status === 403 || status === 404) return status;
  if (status >= 500 && status <= 599) return status;
  return 500;
}

function imageContent(prompt, images) {
  if (!images?.length) return prompt;
  return [
    { type: "text", text: prompt },
    ...images.map(url => ({
      type: "image_url",
      image_url: { url }
    }))
  ];
}

async function compat({
  key,
  baseUrl,
  model,
  prompt,
  images = [],
  provider,
  maxTokens = 220,
  retries = 1
}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(baseUrl.includes("openrouter.ai") ? {
          "HTTP-Referer": "https://ai-tournament-iota.vercel.app/",
          "X-Title": "Kyle's Brain Trust"
        } : {})
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: imageContent(prompt, images)
        }],
        temperature: 0.2,
        max_tokens: maxTokens
      })
    });

    const raw = await response.text();
    const data = parseJson(raw);

    if (response.ok) {
      const text = String(data?.choices?.[0]?.message?.content || "").trim();
      if (!text) throw new Error(`${provider} ${model} returned an empty answer.`);
      return {
        text,
        actualModel: String(data?.model || model),
        status: response.status
      };
    }

    const msg = messageFrom(data, raw, response.status);
    lastError = makeError(provider, model, response.status, msg);

    if (response.status === 429 && attempt < retries) {
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      await sleep(
        retryAfter > 0
          ? Math.min(7000, retryAfter * 1000)
          : 1000 + Math.floor(Math.random() * 700)
      );
      continue;
    }

    if (response.status >= 500 && response.status <= 599 && attempt < retries) {
      await sleep(900 + Math.floor(Math.random() * 600));
      continue;
    }

    break;
  }

  throw lastError || new Error(`${provider} ${model} failed.`);
}

async function callOpenRouterFree({ key, prompt, images }) {
  const result = await compat({
    key,
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
    prompt,
    images,
    provider: "OpenRouter Free",
    maxTokens: 220,
    retries: 1
  });

  return {
    ...result,
    route: "openrouter/free",
    free: true
  };
}

async function callDeepSeek({ prompt }) {
  if (!process.env.DEEPSEEK_API_KEY) {
    const e = new Error("DEEPSEEK_API_KEY is not configured.");
    e.status = 503;
    throw e;
  }

  if (Date.now() < deepSeekNativeBlockedUntil) {
    const e = new Error("DeepSeek native is temporarily rate-limited or out of funds.");
    e.status = 429;
    throw e;
  }

  try {
    const native = await compat({
      key: process.env.DEEPSEEK_API_KEY,
      baseUrl: "https://api.deepseek.com/v1",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      prompt,
      images: [],
      provider: "DeepSeek native",
      maxTokens: 220,
      retries: 0
    });

    return {
      ...native,
      route: "deepseek/native",
      free: false
    };
  } catch (e) {
    if ([402, 403, 429].includes(Number(e.status || 0))) {
      deepSeekNativeBlockedUntil = Date.now() + 10 * 60 * 1000;
    }
    throw e;
  }
}

async function callMistral({ prompt, images }) {
  if (!process.env.MISTRAL_API_KEY) {
    const e = new Error("MISTRAL_API_KEY is not configured.");
    e.status = 503;
    throw e;
  }

  if (Date.now() < mistralNativeBlockedUntil) {
    const e = new Error("Mistral native Free mode is temporarily rate-limited or unavailable.");
    e.status = 429;
    throw e;
  }

  try {
    const native = await compat({
      key: process.env.MISTRAL_API_KEY,
      baseUrl: "https://api.mistral.ai/v1",
      model: process.env.MISTRAL_MODEL || "mistral-small-latest",
      prompt,
      images,
      provider: "Mistral native",
      maxTokens: 220,
      retries: 1
    });

    return {
      ...native,
      route: "mistral/native-free",
      free: true
    };
  } catch (e) {
    if ([402, 403, 429].includes(Number(e.status || 0))) {
      mistralNativeBlockedUntil = Date.now() + 2 * 60 * 1000;
    }
    throw e;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  const provider = String(req.body?.provider || "").toLowerCase();
  const prompt = String(req.body?.challenge || "").trim();
  const images = Array.isArray(req.body?.images)
    ? req.body.images.slice(0, 6)
    : [];

  if (!prompt) {
    return res.status(400).json({ error: "No challenge/prompt supplied." });
  }

  const started = Date.now();

  try {
    let result;

    if (provider === "openrouter") {
      if (!process.env.OPENROUTER_API_KEY) {
        return res.status(503).json({
          error: "OPENROUTER_API_KEY is not configured."
        });
      }
      result = await callOpenRouterFree({
        key: process.env.OPENROUTER_API_KEY,
        prompt,
        images
      });
    } else if (provider === "deepseek") {
      result = await callDeepSeek({ prompt, images });
    } else if (provider === "mistral") {
      result = await callMistral({ prompt, images });
    } else {
      return res.status(400).json({
        error: `FREE-LIFE does not handle provider: ${provider}`
      });
    }

    return res.status(200).json({
      guess: result.text,
      provider,
      model: result.actualModel,
      route: result.route,
      free: Boolean(result.free),
      latency: Date.now() - started,
      success: true
    });
  } catch (e) {
    return res.status(statusForError(e)).json({
      error: e?.message || String(e),
      provider,
      success: false,
      latency: Date.now() - started
    });
  }
}

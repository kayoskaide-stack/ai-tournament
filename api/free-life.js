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
  e.status = status;
  e.provider = provider;
  e.model = model;
  return e;
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

async function ladder(models, call) {
  let lastError;

  for (const model of models) {
    try {
      return await call(model);
    } catch (e) {
      lastError = e;

      // Invalid/retired/unavailable endpoint: next model.
      if ([400, 404, 429, 500, 502, 503, 504].includes(Number(e.status || 0))) {
        continue;
      }

      // Authentication/billing problems on one route may still allow another.
      if ([401, 402, 403].includes(Number(e.status || 0))) {
        continue;
      }

      continue;
    }
  }

  throw lastError || new Error("No free model in this ladder answered.");
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

async function callDeepSeek({ prompt, images }) {
  // If native DeepSeek has credit, use it automatically.
  if (
    process.env.DEEPSEEK_API_KEY &&
    Date.now() >= deepSeekNativeBlockedUntil
  ) {
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
      // Then fall through to genuine DeepSeek models on OpenRouter.
    }
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "DeepSeek native is unavailable and OPENROUTER_API_KEY is not configured for the free DeepSeek fallback."
    );
  }

  const models = [
    "deepseek/deepseek-v4-flash-0731:free",
    "deepseek/deepseek-v4-flash:free",
    "deepseek/deepseek-chat-v3.1:free",
    "deepseek/deepseek-r1:free",
    "deepseek/deepseek-chat:free"
  ];

  const result = await ladder(models, model =>
    compat({
      key: process.env.OPENROUTER_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
      model,
      prompt,
      images: [],
      provider: "DeepSeek via OpenRouter",
      maxTokens: 220,
      retries: 1
    })
  );

  return {
    ...result,
    route: "openrouter/deepseek-free",
    free: true
  };
}

async function callMistral({ prompt, images }) {
  // Prefer Mistral's own Free-mode API whenever it is accepting requests.
  if (
    process.env.MISTRAL_API_KEY &&
    Date.now() >= mistralNativeBlockedUntil
  ) {
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
      // If native Free mode is throttled, use a genuine Mistral free model via OR.
    }
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "Mistral Free mode is temporarily unavailable and OPENROUTER_API_KEY is not configured for the free Mistral fallback."
    );
  }

  const coding = /\b(code|coding|javascript|python|node|bash|shell|bug|repo|function|script|api)\b/i.test(prompt);

  const models = coding
    ? [
        "mistralai/devstral-2512:free",
        "mistralai/devstral-small:free",
        "mistralai/mistral-nemo:free",
        "mistralai/mistral-7b-instruct:free"
      ]
    : [
        "mistralai/mistral-nemo:free",
        "mistralai/mistral-7b-instruct:free",
        "mistralai/devstral-2512:free"
      ];

  const result = await ladder(models, model =>
    compat({
      key: process.env.OPENROUTER_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
      model,
      prompt,
      images,
      provider: "Mistral via OpenRouter",
      maxTokens: 220,
      retries: 1
    })
  );

  return {
    ...result,
    route: "openrouter/mistral-free",
    free: true
  };
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
    return res.status(500).json({
      error: e?.message || String(e),
      provider,
      success: false,
      latency: Date.now() - started
    });
  }
}

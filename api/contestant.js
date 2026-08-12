const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  gemini: "gemini-3-flash-preview",
  anthropic: "claude-3-5-haiku-latest",
  xai: "grok-4.5",
};

function cleanGuess(value) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error("Provider returned an empty answer.");
  return text;
}

async function readJson(response, provider) {
  const raw = await response.text();
  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      `${provider} returned non-JSON data (HTTP ${response.status}): ${raw.slice(0, 500)}`
    );
  }

  if (!response.ok) {
    const details =
      data?.error?.message ||
      data?.error ||
      data?.message ||
      raw ||
      `HTTP ${response.status}`;

    throw new Error(`${provider} request failed (HTTP ${response.status}): ${details}`);
  }

  return data;
}

async function callOpenAICompatible({ key, model, prompt, image, baseUrl, provider }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: image ? [{type:"text",text:prompt},{type:"image_url",image_url:{url:image}}] : prompt }],
      temperature: 0.2,
      max_tokens: 700,
    }),
  });

  const data = await readJson(response, provider);
  return data?.choices?.[0]?.message?.content;
}

async function callGemini({ key, model, prompt, image }) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt },...(image?[{inline_data:{mime_type:(image.match(/^data:([^;]+)/)||[])[1]||"image/jpeg",data:image.split(",")[1]}}]:[])],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 700,
      },
    }),
  });

  const data = await readJson(response, "Gemini");
  return data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("");
}

async function callClaude({ key, model, prompt }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await readJson(response, "Claude");
  return data?.content
    ?.filter((item) => item?.type === "text")
    .map((item) => item.text)
    .join("");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  const {
    provider,
    name = "Contestant",
    model,
    mode = "autocorrect",
    challenge = "",
    image = "",
    hint = "",
    used = [],
  } = req.body || {};

  const normalizedProvider = String(provider || "").toLowerCase();
  const selectedModel = model || DEFAULT_MODELS[normalizedProvider];

  const prompt = `You are ${name}, participating in a friendly IRC-style group chat with Kyle and another AI.
Reply naturally and conversationally to Kyle's message below.
Stay in character, be warm, witty, helpful, and concise.
Do not pretend this is a guessing game.
Do not restrict yourself to one word.

Kyle's message: ${challenge}`;

  const startedAt = Date.now();

  try {
    let text;

    if (normalizedProvider === "openai") {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({ error: "OPENAI_API_KEY is not configured." });
      }

      text = await callOpenAICompatible({
        key: process.env.OPENAI_API_KEY,
        model: selectedModel,
        prompt,
        image,
        baseUrl: "https://api.openai.com/v1",
        provider: "OpenAI",
      });
    } else if (normalizedProvider === "gemini") {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: "GEMINI_API_KEY is not configured." });
      }

      text = await callGemini({
        key: process.env.GEMINI_API_KEY,
        model: selectedModel,
        prompt,
        image,
      });
    } else if (normalizedProvider === "anthropic") {
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ error: "ANTHROPIC_API_KEY is not configured." });
      }

      text = await callClaude({
        key: process.env.ANTHROPIC_API_KEY,
        model: selectedModel,
        prompt,
      });
    } else if (normalizedProvider === "xai") {
      if (!process.env.XAI_API_KEY) {
        return res.status(503).json({ error: "XAI_API_KEY is not configured." });
      }

      text = await callOpenAICompatible({
        key: process.env.XAI_API_KEY,
        model: selectedModel,
        prompt,
        baseUrl: "https://api.x.ai/v1",
        provider: "xAI",
      });
    } else if (normalizedProvider === "duck") {
      return res.status(503).json({
        error:
          "Duck has no provider configured. DuckDuckGo does not offer an official public AI Chat API key.",
      });
    } else {
      return res.status(503).json({
        error: `Unknown or unsupported provider: ${provider || "(missing)"}`,
      });
    }

    const guess = cleanGuess(text);
    const latency = Date.now() - startedAt;

    console.log(
      JSON.stringify({
        event: "contestant_success",
        provider: normalizedProvider,
        model: selectedModel,
        guess,
        latency,
      })
    );

    return res.status(200).json({
      guess,
      provider: normalizedProvider,
      model: selectedModel,
      latency,
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const latency = Date.now() - startedAt;

    console.error(
      JSON.stringify({
        event: "contestant_error",
        provider: normalizedProvider,
        model: selectedModel,
        latency,
        error: message,
      })
    );

    return res.status(500).json({
      error: message,
      provider: normalizedProvider,
      model: selectedModel,
      success: false,
    });
  }
}

import { providerFetch } from './provider-request.js';
import { panelMessages, parsePanelReply } from './panel-review.js';
let catalogCache = { until: 0, models: [], pending: null };
const cooldowns = new Map();
const ZERO_FIELDS = ['prompt', 'completion', 'request', 'image', 'web_search', 'internal_reasoning'];
export function isFreeTextModel(m) {
  return typeof m?.id === 'string' && m.id.endsWith(':free') &&
    m.architecture?.output_modalities?.includes('text') &&
    ZERO_FIELDS.every(k => k in (m.pricing || {}) ? Number(m.pricing[k]) === 0 : !['prompt','completion'].includes(k));
}
export async function freeCatalog() {
  if (Date.now() < catalogCache.until) return catalogCache.models;
  if (catalogCache.pending) return catalogCache.pending;
  catalogCache.pending = (async () => {
    const r = await providerFetch('https://openrouter.ai/api/v1/models');
    if (!r.ok) throw new Error('Free model catalog is temporarily unavailable.');
    const data = await r.json();
    const models = (data.data || []).filter(isFreeTextModel).map(m => ({
      id: m.id, name: String(m.name || m.id).replace(/\s*\(free\)/i,''),
      family: m.id.split('/')[0], context: m.context_length || 0,
      vision: m.architecture?.input_modalities?.includes('image') || false,
      created: m.created || 0,
      reasoning: m.supported_parameters?.includes('reasoning') || false,
      maxOutput: m.top_provider?.max_completion_tokens || 0
    })).sort((a,b) => b.created-a.created || b.context-a.context);
    catalogCache = { until: Date.now()+300000, models, pending: null };
    return models;
  })().finally(() => { catalogCache.pending = null; });
  return catalogCache.pending;
}
export function selectFreeBrains(models, count = 4) {
  const selected = [], families = new Set();
  for (const m of models) if (!families.has(m.family)) {
    selected.push(m); families.add(m.family); if (selected.length === count) break;
  }
  return selected;
}
export async function freePowerCatalog() {
  let models = [], error = '';
  try { models = await freeCatalog(); } catch { error = 'Catalog unavailable; refresh to retry.'; }
  return { configured: Boolean(process.env.OPENROUTER_API_KEY), models,
    recommended: selectFreeBrains(models), error,
    identityPolicy: 'requested-model-must-match-returned-model',
    pricingPolicy: 'zero-price-only',
    note: 'Zero-priced OpenRouter models. Shared account rate and daily limits apply. Different model families are not guaranteed independent training sources.' };
}
export async function callFreeBrain({ model, prompt, images = [], panel = null }) {
  if (!process.env.OPENROUTER_API_KEY) throw Object.assign(new Error('Free AI Power needs the configured OpenRouter connection.'), { status: 503 });
  const catalog = await freeCatalog(), entry = catalog.find(m => m.id === model);
  if (!entry) throw Object.assign(new Error('This model is no longer listed at zero price. Refresh the free roster.'), { status: 400 });
  if (images.length && !entry.vision) throw Object.assign(new Error('This model cannot view images. Select a vision-capable free model.'), { status: 400 });
  if (Date.now() < (cooldowns.get(model) || 0)) throw Object.assign(new Error('Free model is cooling down after a rate limit. Try another brain.'), { status: 429 });
  const started = Date.now();
  const review = panel ? panelMessages({ ...panel, model, question: prompt }) : null;
  const text = review?.prompt || prompt;
  const signal = AbortSignal.timeout(38000);
  let lastError, omitReasoning = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const budget = attempt ? 4096 : 2048;
      const system = review?.system || 'Answer the user directly and concisely.';
      const r = await providerFetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', signal,
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Brain Trust Free AI Power' },
        body: JSON.stringify({ model,
          messages: [{role:'system',content:system + (attempt ? '\nThe previous request did not produce a usable final answer. Give a brief complete final answer now. Do not output PASS or thinking alone.' : '')},
            { role: 'user', content: images.length ? [{ type:'text', text }, ...images.map(url=>({type:'image_url',image_url:{url}}))] : text }],
          max_tokens: entry.maxOutput > 0 ? Math.min(budget, entry.maxOutput) : budget,
          ...(entry.reasoning && !omitReasoning ? {reasoning:{enabled:false}} : {}),
          provider: { allow_fallbacks: true, max_price: { prompt: 0, completion: 0 } }
        })
      });
      const d = await r.json().catch(()=>({}));
      if (!r.ok || d.error) {
        const status = r.status >= 400 ? r.status : Number(d.error?.code) || 502;
        if (status === 429) cooldowns.set(model, Date.now()+60000);
        const reasoningRejected = status === 400 && entry.reasoning && !omitReasoning;
        if (reasoningRejected) omitReasoning = true;
        const message = status === 429 ? 'Shared free quota or rate limit reached. Retry later.'
          : status === 402 ? 'The free-route account quota is exhausted. No paid request was made.'
          : `Free model request failed (HTTP ${status}).`;
        throw Object.assign(new Error(message), {status, retryable:status >= 500 || reasoningRejected});
      }
      const actualModel = String(d.model || model).trim();
      if (actualModel.toLowerCase() !== String(model).trim().toLowerCase()) {
        throw Object.assign(new Error(`Model identity mismatch: requested ${model}, provider returned ${actualModel}. Response rejected.`), {status:502,retryable:false});
      }
      const choice = d.choices?.[0], content = choice?.message?.content;
      const guess = (typeof content === 'string' ? content : Array.isArray(content)
        ? content.filter(x=>x?.type==='text' && typeof x.text==='string').map(x=>x.text).join('\n') : '').trim();
      if (choice?.finish_reason === 'length') throw Object.assign(new Error('The model used its output budget before finishing its answer.'), {status:502,retryable:true});
      if (!guess || /^PASS[.!]?$/i.test(guess)) throw Object.assign(new Error(
        choice?.message?.reasoning || choice?.message?.reasoning_details?.length
          ? 'The model returned thinking without a final answer.' : 'The model returned an empty final answer.'), {status:502,retryable:true});
      const result = review ? parsePanelReply(guess, review.mayReview, {allowPlainText:true}) : {guess,participation:'answered'};
      const usage = d.usage && typeof d.usage === 'object' ? {
        promptTokens: Number(d.usage.prompt_tokens || 0),
        completionTokens: Number(d.usage.completion_tokens || 0),
        totalTokens: Number(d.usage.total_tokens || 0)
      } : null;
      return { ...result, provider: entry.family, actualProvider: entry.family, model: actualModel, requestedModel: model,
        route: 'openrouter/free-power', free: true, estimatedCostUsd: 0, usage,
        identityVerified: true, fallback: false, success: true, attempts:attempt+1, latency: Date.now()-started };
    } catch (e) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError' || signal.aborted) {
        lastError = Object.assign(new Error('Free model request timed out before a final answer arrived.'), {status:504,retryable:true});
      } else lastError = e;
      if (!attempt && !lastError.retryable && lastError.status !== 502) throw lastError;
      if (attempt || signal.aborted) break;
    }
  }
  throw Object.assign(new Error(`${lastError.message} No completed answer was received after the bounded retry.`), {status:lastError.status || 503});
}
export default async function freePower(req,res) {
  if (req.method === 'GET') return res.status(200).json(await freePowerCatalog());
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
  const prompt = String(req.body?.challenge || '').trim();
  const images = Array.isArray(req.body?.images) ? req.body.images.slice(0,6).filter(x=>typeof x==='string' && /^data:image\/(png|jpeg|webp);base64,/.test(x)) : [];
  if (!prompt || prompt.length > 40000) return res.status(400).json({ error:'A question under 40,000 characters is required.' });
  const requestedMode = String(req.body?.mode || 'review').toLowerCase();
  const mode = ['review','challenge','synthesis'].includes(requestedMode) ? requestedMode : 'review';
  const panel = req.body?.panel === true ? {
    history: String(req.body?.history || '').slice(-10000),
    prior: Array.isArray(req.body?.prior) ? req.body.prior.slice(-12) : [],
    mode,
    perspective: mode === 'synthesis' ? 'Final editor: reconcile the panel into one useful answer'
      : ['Direct answer','Check assumptions and risks','Practical alternative or example','Check reasoning and missing details'][Number(req.body?.seat) % 4] || 'Direct answer'
  } : null;
  try { return res.status(200).json(await callFreeBrain({ model: String(req.body?.model || ''), prompt, images, panel })); }
  catch(e) { return res.status(e.status || 503).json({ success:false, error:e.message }); }
}

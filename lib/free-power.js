import { providerFetch } from './provider-request.js';
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
      created: m.created || 0
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
    note: 'Zero-priced OpenRouter models. Shared account rate and daily limits apply. Different model families are not guaranteed independent training sources.' };
}
export async function callFreeBrain({ model, prompt, images = [] }) {
  if (!process.env.OPENROUTER_API_KEY) throw Object.assign(new Error('Free AI Power needs the configured OpenRouter connection.'), { status: 503 });
  const catalog = await freeCatalog(), entry = catalog.find(m => m.id === model);
  if (!entry) throw Object.assign(new Error('This model is no longer listed at zero price. Refresh the free roster.'), { status: 400 });
  if (images.length && !entry.vision) throw Object.assign(new Error('This model cannot view images. Select a vision-capable free model.'), { status: 400 });
  if (Date.now() < (cooldowns.get(model) || 0)) throw Object.assign(new Error('Free model is cooling down after a rate limit. Try another brain.'), { status: 429 });
  const started = Date.now();
  const r = await providerFetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Brain Trust Free AI Power' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: images.length ? [{ type:'text', text:prompt }, ...images.map(url=>({type:'image_url',image_url:{url}}))] : prompt }], max_tokens: 600, provider: { allow_fallbacks: true, max_price: { prompt: 0, completion: 0 } } })
  });
  const d = await r.json().catch(()=>({}));
  if (!r.ok || d.error) {
    if (r.status === 429) cooldowns.set(model, Date.now()+60000);
    throw Object.assign(new Error(r.status === 429 ? 'Shared free quota or rate limit reached. Retry later.' : `Free model request failed (HTTP ${r.status}).`), { status: r.status >= 400 ? r.status : 502 });
  }
  const guess = String(d.choices?.[0]?.message?.content || '').trim();
  if (!guess || guess === 'PASS') throw Object.assign(new Error('The free model returned no substantive answer.'), { status: 502 });
  return { guess, provider: entry.family, actualProvider: entry.family, model: d.model || model, requestedModel: model, route: 'openrouter/free-power', free: true, fallback: false, success: true, latency: Date.now()-started };
}
export default async function freePower(req,res) {
  if (req.method === 'GET') return res.status(200).json(await freePowerCatalog());
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
  const prompt = String(req.body?.challenge || '').trim();
  const images = Array.isArray(req.body?.images) ? req.body.images.slice(0,6).filter(x=>typeof x==='string' && /^data:image\/(png|jpeg|webp);base64,/.test(x)) : [];
  if (!prompt || prompt.length > 40000) return res.status(400).json({ error:'A question under 40,000 characters is required.' });
  try { return res.status(200).json(await callFreeBrain({ model: String(req.body?.model || ''), prompt, images })); }
  catch(e) { return res.status(e.status || 503).json({ success:false, error:e.message }); }
}

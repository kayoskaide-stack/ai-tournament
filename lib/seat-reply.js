import contestant from '../api/contestant.js';
import freeLife from '../api/free-life.js';
import { withProviderBudget } from './provider-request.js';

const seats = new Set(['openai','gemini','anthropic','xai','deepseek','mistral','openrouter']);
const freeSeats = new Set(['deepseek','mistral','openrouter']);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function invoke(handler, req, body) {
  let status = 200, data = {};
  const response = {
    setHeader() {},
    status(code) { status = code; return this; },
    json(value) { data = value; return this; }
  };
  try {
    await withProviderBudget(() => handler({ ...req, body }, response));
  } catch (error) {
    status = 504;
    data = { error: error?.name === 'TimeoutError' || error?.name === 'AbortError'
      ? 'Provider request timed out.' : 'Provider connection failed.' };
  }
  const text = typeof data.guess === 'string' ? data.guess.trim() : '';
  if (status < 400 && (!text || text === 'PASS')) {
    status = 502;
    data = { error: 'Provider returned no substantive answer.' };
  }
  return { status, data };
}

function retryable(result) {
  const message = String(result.data?.error || '');
  if (/HTTP (?:400|401|402|403|404)|not configured|balance|billing|credit|quota/i.test(message)) return false;
  return result.status === 429 || result.status >= 500;
}

// Each seat gets its own genuine model call. Substitute identities are explicit.
export default async function seatReply(req, res) {
  const body = req.body || {}, seat = String(body.provider || '').toLowerCase();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!seats.has(seat) || !String(body.challenge || '').trim())
    return res.status(400).json({ error: 'Valid provider and question required.' });
  const primary = freeSeats.has(seat) ? freeLife : contestant;
  const attempts = [];
  let result;
  for (let attempt = 0; attempt < 2; attempt++) {
    result = await invoke(primary, req, { ...body, name: body.name || seat, mode: 'chat' });
    attempts.push({ provider: seat, status: result.status });
    if (result.status < 400) return res.status(200).json({ ...result.data, seat, actualProvider: seat, fallback: false, attempts });
    if (!retryable(result) || attempt === 1) break;
    await sleep(700);
  }
  return res.status(503).json({
    success: false, seat, attempts,
    error: `${seat}: native provider is unavailable. ${result?.data?.error || 'No working route is configured.'}`
  });
}

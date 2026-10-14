import { AsyncLocalStorage } from 'node:async_hooks';

const budgets = new AsyncLocalStorage();
export function withProviderBudget(fn, ms = 30000) {
  return budgets.run(AbortSignal.timeout(ms), fn);
}
export function providerFetch(url, options = {}) {
  const signals = [AbortSignal.timeout(18000), budgets.getStore(), options.signal].filter(Boolean);
  return fetch(url, { ...options, signal: AbortSignal.any(signals) });
}

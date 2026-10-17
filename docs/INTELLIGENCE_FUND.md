# Brain Trust Intelligence Fund

The Intelligence Fund is separate from ordinary project support. It is intended to pay only for AI/model/tool usage that measurably improves Brain Trust beyond the zero-price/local baseline.

## Core rule

Spend the next dollar where it is expected to produce the largest **marginal intelligence gain**: a useful correction, genuinely different reasoning, reliable fallback, verification result, or materially better synthesis.

Brain Trust must not burn money just to make more AI names appear in the room.

## Routing ladder

1. **Free/local baseline** — get a competent initial answer and identify gaps.
2. **Micro-checker** — use a low-cost model for a short independent correction or missing-angle pass.
3. **Specialist** — pay for the model/tool that best matches the unresolved task.
4. **Premium judge** — use one strong model when disagreement, complexity or synthesis quality justifies it.
5. **Stop** — when extra calls stop adding material information, stop spending.

## What gets measured

Brain Trust should compare routes using successful-answer rate, unique useful contribution rate, correction/verification value, disagreement-resolution rate, latency, retry/truncation rate, actual cost per useful contribution, and total cost per materially improved round.

## Budget protections

- Keep a reliability reserve instead of spending the whole pool immediately.
- Canary-test new paid routes before granting them a larger share of the budget.
- No silent model/provider substitution.
- Donors do not buy influence over answers or model conclusions.
- Automatic paid spending is off by default until the owner deliberately enables a bounded budget.
- Payment pages are external HTTPS links; Brain Trust itself does not collect card details.

## Cost-efficiency notes reviewed 2026-10-16

Current official provider pricing strongly favors using inexpensive models for checking/classification and reserving flagship models for hard synthesis. Pricing changes frequently, so Brain Trust should re-check provider pricing before changing routing policy rather than freezing today's prices into permanent code.

Practical savings come from compact checker prompts, short checker outputs, sending expensive models a claim/disagreement summary instead of the full raw transcript, caching repeated verification work when freshness allows, and using discounted batch/off-peak capacity for non-urgent work when a provider offers it.

The policy lives in `config/intelligence-fund-policy.json`; the UI exposes it from Mission Control so contributors can see what the fund is supposed to buy.

# Brain Trust Intelligence Fund

The Intelligence Fund is separate from ordinary project support. It is intended to pay only for AI/model/tool usage that measurably improves Brain Trust beyond the zero-price/local baseline.

## The first-budget rule: assume there will only ever be $15

For bootstrap planning, **USD $15 is the conservative floor / minimum viable bankroll**. The system must be useful on that amount even if no second donation ever arrives. A larger pool is upside, not an assumption.

The first goal is not to make seven AI names light up. The first goal is to prove that a Brain Trust answer is materially better than asking one strong AI directly.

## Research-backed change in strategy

More AI debate is not automatically more intelligence. Published multi-agent work has found inconsistent gains from unrestricted debate, diminishing returns as agents/rounds increase, and strongly correlated errors between nominally different judges. The practical response is:

1. **Independent first opinions** from a small, heterogeneous set of model families.
2. **Targeted challenge** only where there is a meaningful disagreement, omission, factual risk, or specialist need.
3. **Evidence/tools** when they can actually change or support the answer.
4. **One strong adjudicator/synthesizer** for the final response.
5. **Stop** when more calls stop adding material information.

Brain Trust should prefer three genuinely different useful thinkers over seven repetitive speakers.

Research reviewed for this policy includes:
- ICLR Blogposts 2025, *Multi-LLM-Agents Debate — Performance, Efficiency, and Scaling Challenges*: https://iclr-blogposts.github.io/2025/blog/mad/
- Apple Machine Learning Research 2026, *Nine Judges, Two Effective Votes*: https://machinelearning.apple.com/research/correlated-llm-evaluation-panels
- NeurIPS 2025, *Debate or Vote: Which Yields Better Decisions in Multi-Agent Large Language Models?*: https://proceedings.neurips.cc/paper_files/paper/2025/hash/934252acd87f254d5d4672fbde283bd2-Abstract-Conference.html

## Current bootstrap funding recommendation — reviewed 2026-10-16

For a tiny first pool, the current recommendation is to **avoid scattering $5 minimum balances across many direct vendors**. Use one funded gateway first, currently OpenRouter, while keeping direct provider keys available as optional redundancy.

Why OpenRouter is currently attractive for the first pool:
- one wallet reaches hundreds of models and many providers;
- exact model identities can still be requested;
- many models have provider-level failover without pretending one model is another;
- paid-model traffic is not subject to a plan-level request cap;
- after an account has purchased at least $10 in credits, OpenRouter currently raises its free-model daily allowance substantially;
- this avoids stranding most of a $15 pool in several separate minimum top-ups.

OpenRouter currently charges a platform fee when purchasing credits, so **$15 cash does not mean $15 of usable credits**. The application must never spend or purchase beyond the contributed cash balance, and the exact checkout fee/tax must be considered before funding.

Current OpenRouter pricing/availability pages reviewed:
- https://openrouter.ai/pricing
- https://openrouter.ai/models

Direct provider funding should be added later only when telemetry proves a direct route has a real advantage, such as a uniquely valuable tool, better reliability, lower effective cost, or a feature unavailable through the gateway.

## Three operating modes

### Standard
Target paid cost: **up to about $0.01 per round**.

Use three independent inexpensive model-family opinions, normally one round. Escalate only on a real disagreement or failure.

### Smart
Target paid cost: **up to about $0.05 per round**.

Use three independent opinions, targeted challenge, and grounding/tool use when the question is current or evidence-dependent. Maximum five participating agents and normally no more than two debate rounds.

### Deep Council
Target paid cost: **up to about $0.10 per round** with an absolute owner-controlled hard cap of **$0.25 per question**.

This is the showcase / difficult-question mode: independent model-family answers, targeted critique, useful evidence/tools, then one strong paid adjudicator. The final result must be shown in clean Reader View with paragraphs, headings, sources/supporting material when useful, and no intentional IRC-style clipping.

At current token prices, even premium synthesis calls are generally measured in cents for ordinary-sized prompts. That means a $15 pool should be treated as **a substantial proof-of-value runway**, not as permission to waste calls. Actual cost still varies with reasoning tokens, prompt length, tools, retries and model choice, so the UI should report real usage rather than promise a fixed number of answers.

## Proof-of-value gate

The first **20 representative real questions** should be treated as a canary evaluation.

For each one, Brain Trust should be compared with a strong single-model baseline using:
- blind human preference;
- factual support / unsupported claims;
- completeness;
- useful corrections or genuinely new angles;
- readability and formatting;
- truncation/failure rate;
- latency;
- actual paid cost.

If Brain Trust is not clearly better, the response is **not** “buy more tokens.” Fix routing, prompts, model diversity, reliability and presentation first.

## Core rule

Spend the next dollar where it is expected to produce the largest **marginal intelligence gain**: a useful correction, genuinely different reasoning, reliable tool result, verification result, or materially better synthesis.

Brain Trust must not burn money just to make more AI names appear in the room.

## Routing ladder

1. **Classify** — decide freshness, tools and diversity needs.
2. **Independent triad** — three cheap but capable model families form their own answers before seeing one another.
3. **Cross-examine** — only models likely to resolve a real issue get another turn.
4. **Ground** — retrieve current sources, documents, images or calculations when they materially help.
5. **Adjudicate** — one strong model receives the compact claims, disagreements and evidence and writes the final answer.
6. **Stop** — after stability/no-new-information or two debate rounds unless the owner deliberately overrides.

## What gets measured

Brain Trust should compare routes using successful-answer rate, **Brain Trust vs single-model win rate**, unique useful contribution rate, semantic duplication rate, correction/verification value, disagreement-resolution rate, latency, retry/truncation rate, actual cost per useful contribution, total cost per materially improved round, and remaining fund runway.

A paid AI that only paraphrases what another AI already said should count against the route, not in its favor.

## Budget protections

- Keep a 20% reliability reserve rather than spending the whole pool immediately.
- Canary-test new paid routes before granting them a larger share.
- Avoid letting one model family consume more than roughly 35% of the pool without review.
- No silent model/provider substitution.
- Donors do not buy influence over answers or model conclusions.
- Future donations are never assumed in the current budget.
- Automatic paid spending is off by default until the owner deliberately enables a bounded budget.
- Payment pages are external HTTPS links; Brain Trust itself does not collect card details.

## Product defects are not intelligence expenses

The following should be fixed in code rather than “solved” by paying another AI:
- outputs cut in half because of a bad output limit;
- unreadable unformatted text blobs;
- seats firing with missing keys or known-empty balances;
- repeated identical opinions;
- needless retries caused by our own request format;
- the UI showing a failed seat as though it contributed intelligence.

The Intelligence Fund is for **better reasoning/evidence**, not for masking software defects.

The machine-readable policy lives in `config/intelligence-fund-policy.json`; Mission Control exposes the policy so contributors can see what their money is supposed to buy.

# Payment setup

Brain Trust deliberately does not process card details itself.

Configure these public HTTPS links in the deployment environment:

- `BRAINTRUST_DONATE_URL` — ordinary project support / coffee link.
- `BRAINTRUST_INTELLIGENCE_FUND_URL` — earmarked Intelligence Fund contribution link.

## Recommended separation

### Coffee / general support
A creator-support service such as Buy Me a Coffee is fine here because convenience and familiarity matter more than squeezing every cent into inference.

### Intelligence Fund
For the Intelligence Fund, prefer a lower-overhead hosted payment rail such as a direct Stripe Payment Link rather than routing through an extra creator-platform fee layer. The reason is simple: the expected donations may be only a few dollars each, so fixed and percentage processing fees are material.

Research reviewed 2026-10-16:
- Buy Me a Coffee states that it charges creators 5%, with payment-partner processing fees charged separately: https://buymeacoffee.com/terms
- Stripe Canada lists standard domestic online-card pricing of 2.9% + CA$0.30 per successful transaction, with Payment Links included with Payments: https://stripe.com/en-ca/pricing

This is a current recommendation, not a permanent hard-coded dependency. Re-check fees before launch.

## Currency accounting

API providers generally quote model usage in USD, while local contributors may donate in CAD or another currency. Brain Trust must not silently treat those as the same number. The fund ledger should preserve:

- contribution amount and contribution currency;
- processor fees;
- net amount received;
- any FX conversion cost;
- API credit amount purchased;
- actual API/tool spend in the provider's billing currency.

The UI should report both money collected and usable intelligence balance clearly rather than presenting gross donations as though every dollar reached model inference.

## Safety / accounting boundary

The UI keeps the two purposes distinct. The Intelligence Fund page explains that contributed money is intended for measured AI/model/tool usage under the marginal-intelligence budget policy.

A payment provider can be changed later without changing the AI routing policy. Stripe Payment Links, Buy Me a Coffee, or another trusted hosted checkout can be used as long as the deployed value is HTTPS.

Automatic AI spending is not enabled merely because a contribution link exists. Provider API balances/credits and any automated budget ledger remain separately controlled. Donors do not buy influence over answers.

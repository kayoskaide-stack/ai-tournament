# Payment setup

Brain Trust deliberately does not process card details itself.

Configure these public HTTPS links in the deployment environment:

- `BRAINTRUST_DONATE_URL` — ordinary project support / coffee link.
- `BRAINTRUST_INTELLIGENCE_FUND_URL` — earmarked Intelligence Fund contribution link.

The UI keeps the two purposes distinct. The Intelligence Fund page explains that contributed money is intended for measured AI/model/tool usage under the marginal-intelligence budget policy.

A payment provider can be changed later without changing the AI routing policy. Stripe Payment Links, Buy Me a Coffee, or another trusted hosted checkout can be used as long as the deployed value is HTTPS.

Automatic AI spending is not enabled merely because a contribution link exists. Provider API balances/credits and any automated budget ledger remain separately controlled.

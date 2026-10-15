# Mandatory guest registration

Guests now follow invite code → confirm email → verify CService/X → chat.
The existing owner's access-code and email login remain available.

Access-code login creates a signed, one-hour onboarding session without chat
permission. Existing unverified member and maintainer cookies are rejected.
An invite holder may confirm their own email; an extra environment email
allowlist is not needed. Email-only guest login cannot bypass the invite.
Confirmation links expire after 15 minutes and are consumed once on an explicit
POST, so a mail scanner GET does not consume them.

The guest registers and confirms an account at https://cservice.undernet.org/,
connects through an IRC client, and logs in to X there. Brain Trust never collects
the guest's X password. A private `!verify` command proves control of that IRC
nickname; the relay requests WHOIS and accepts only the server's account numeric
330 followed by completion 318. This works before joining the private channel.
The account proof is bound to the invited account's revision and random
onboarding flow. Missing, expired, unavailable, or unverified results never
grant chat access. The resulting web session uses the existing session lifetime.
Revoke or rotate an invite to invalidate its web sessions after redeployment.

Challenges and email-link consumption records persist in the relay's private
`data/identity-challenges.json`, outside the repository. Include this file in
private relay backups. Never publish it. Relay restarts discard pending WHOIS
requests and retain completed verification state until its 15-minute expiry.

## Deployment prerequisites

- Back up the current main commit and live relay before approving production.
- Keep `BRAINTRUST_SESSION_SECRET` (or the existing admin signing fallback).
- Configure `RESEND_API_KEY`, `BRAINTRUST_EMAIL_FROM` with an authorized sending
  domain, and `BRAINTRUST_PUBLIC_URL` for the intended web environment.
- `BRAINTRUST_RELAY_BASE_URL` must point to the trusted HTTPS bridge, with
  `BRAINTRUST_RELAY_TOKEN` matching the Shellter bridge token.
- Deploy the updated relay before testing guest registration. It adds
  authenticated `/identity/start`, `/identity/status`, and
  `/identity/consume-email` routes to the existing bridge.
- The Shellter watcher extracts only `relay.mjs`; its identity gate is embedded
  intentionally. A test enforces equality with the independently tested module.
- With `IRC_ENFORCE_MODES=1`, the relay requests registered-users-only channel
  mode `+r` only after its operator status has been observed. Grant the bot
  appropriate X channel access; inspect the actual channel modes after restart.

Before production approval, verify real Resend delivery to a controlled account,
an X-authenticated guest's private challenge, channel mode `+r`, revocation, and
both directions of shared chat delivery. Local tests use synthetic accounts and
mock all email/provider HTTP calls; they do not prove production credentials,
DNS, or bridge reachability. This change fixes admission; it does not implement
a separate IRC connection per web guest or repair shared chat transport.

## Validation

`node --test tests/onboarding.test.mjs` tests both gates, old sessions, invite
revision checks, forged replies, timeout/disconnect handling, persistence,
email replay, cross-origin rejection, and outage handling.

`node tests/onboarding-browser.cjs` is an optional Playwright mobile UI check
with all network routes intercepted. It requires Playwright Chromium installed.

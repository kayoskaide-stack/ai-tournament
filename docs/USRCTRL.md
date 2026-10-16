# Brain Trust User Control

`/usrctrl` is the preferred owner interface for invitations and access control.
The older `/users`, `/invite`, `/revoke`, `/role`, and `/rotate` commands remain
available for compatibility, but new documentation should point owners to
`/usrctrl`.

## New-friend registration flow

1. The owner opens Mission Control → **User Control / Invites**, visits
   `/usrctrl.html`, or runs `/usrctrl add NICK member`.
2. Brain Trust creates the registry entry and returns a one-time `BT-...` access
   code. Only its SHA-256 hash is committed. The owner sends the code privately.
3. The friend opens Brain Trust, enters the invited nickname and access code.
   This creates an onboarding session only; chat remains unavailable.
4. The friend enters an email address. Resend sends **Confirm your email for
   Kyle’s Brain Trust** with a 15-minute confirmation link. A mail scanner GET
   does not consume the link; the user must press the confirmation button.
5. After email confirmation, Brain Trust instructs the friend to register and
   confirm an Undernet CService account, connect to Undernet, log in to X in the
   IRC client, and send the generated private `/msg ... !verify ...` challenge.
   Brain Trust never asks for or receives the X password.
6. The trusted relay checks the IRC nickname with server WHOIS. Only the
   server-reported account numeric followed by WHOIS completion satisfies the
   CService gate. Typed usernames or forged chat messages do not.
7. On success, Brain Trust admits the member and records only
   `verified: true` in the public nickname registry. It does not write the
   friend’s email address or CService account name to GitHub.

The owner table shows **INVITED · PENDING**, **CSERVICE VERIFIED**, or
**REVOKED**. Registration status recorded before this feature did not exist, so
older users may initially appear pending until they complete the current gate
again or their credential is rotated.

## Web command reference

- `/usrctrl` or `/usrctrl open` — owner modal table
- `/usrctrl pop` — separate popup window
- `/usrctrl page` — open the standalone owner page
- `/usrctrl link` — copy the direct owner-page URL
- `/usrctrl list` — compact user list
- `/usrctrl show NICK` — one user’s current state
- `/usrctrl add NICK [member|maintainer]` — create invitation and one-time code
- `/usrctrl revoke NICK` — revoke access and sessions after redeploy
- `/usrctrl activate NICK` — reactivate; registration must be completed again
- `/usrctrl role NICK member|maintainer` — change role and require registration again
- `/usrctrl rotate NICK` — replace the access code and require registration again
- `/usrctrl help` — concise command help

The GUI and command system both use `/api/users`, which enforces the
`manage_users` capability. The standalone `/usrctrl.html` shell is harmless to
open without authorization because its data and mutations remain protected by
the API.

## Mission Control

When the authenticated user has `manage_users`, Mission Control receives a
**User Control / Invites** button. It opens the same table and actions as
`/usrctrl`. Members and maintainers without that capability do not receive the
button.

## Eggdrop adapter

`shellter/eggdrop-usrctrl.tcl` provides the same administrative mutations to an
Eggdrop owner. It binds `!usrctrl` in-channel and `usrctrl` in private messages,
but only for Eggdrop users with the global `+n` owner flag. One-time invitation
and rotation codes are sent back with IRC NOTICE and are never echoed publicly.

The Eggdrop process needs:

- `BRAINTRUST_PUBLIC_URL` — production Brain Trust origin
- `BRAINTRUST_RELAY_TOKEN` — the trusted relay token shared with production

Then source the adapter from Eggdrop’s configuration. The API endpoint used by
the adapter is `/api/admin?scope=irc-users`; it accepts only the trusted relay
bearer token, and user mutations remain production-only.

The current Brain Trust IRC daemon in this repository is the Node Shellter
relay, not Eggdrop. Therefore committing this Tcl adapter makes Eggdrop support
ready, but it is not active on a separate Eggdrop process until that process
sources the file. The guarded Shellter watcher continues to deploy only
`shellter/relay.mjs`.

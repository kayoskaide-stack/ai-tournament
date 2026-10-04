# Brain Trust security model

Ordinary chat can never modify production.

Architecture flow:
1. authenticated Owner/Maintainer creates a proposal;
2. Auto-Pilot creates a backup tag and isolated branch/PR;
3. Vercel/GitHub checks and preview run;
4. Owner Kyle explicitly approves;
5. only then may `main` change;
6. Vercel deploys web changes and Shellter's guarded watcher deploys `shellter/relay.mjs`;
7. rollback remains available from the pre-change backup tag.

Roles:
- Owner: Kyle. Full control including approvals, rollback, users and lockdown.
- Maintainer: chat + propose + preview. No production approval by default.
- Member: chat/use the Brain Trust only.

Per-user access-code hashes are stored in `security/users.js`. Plaintext access codes are never committed.
Revocation increments a user's revision so existing cookies become invalid after redeploy.

The IRC relay supports `IRC_CHANNEL_KEY` and optional `IRC_ENFORCE_MODES=1`.
The actual IRC key remains only in Shellter `.env` and Kyle's private recovery note.

Never commit `.env`, API keys, IRC keys, access-code plaintext, passwords, or private SSH keys.

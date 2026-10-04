# Shellter relay deployment

`relay.mjs` is the canonical, secret-free source for the PrincessGPT IRC relay.

The live Shellter machine keeps secrets only in:

`~/princess/irc-relay/.env`

The autodeployer installed on Shellter:
1. fetches the public `main` branch,
2. extracts only `shellter/relay.mjs`,
3. runs `node --check`,
4. backs up the live relay,
5. deploys and restarts PrincessGPT,
6. rolls back automatically if the tmux relay does not remain running.

Never commit `.env`, API keys, passwords, tokens, or SSH private keys here.

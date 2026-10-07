# Brain Trust legacy tools

The relay can expose these server-side commands through environment variables:

- `BRAINTRUST_CATFISH_CMD` — command used for `!catfish`
- `BRAINTRUST_HUNT_CMD` — command used for `!hunt`
- `BRAINTRUST_ASCII_CMD` — command used for ASCII/ANSI/banner conversion

The commands execute on the trusted relay host, never in the browser.

Recommended source repository for legacy implementations:
`https://github.com/kayoskaide-stack/PrincessGPT-Alpine.git`

Do not auto-install unknown historical dependencies into production. Fetch source separately,
review it, then point the command variables at the vetted wrapper scripts.

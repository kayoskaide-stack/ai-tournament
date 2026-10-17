## Proposed release

This candidate is intentionally broad but grouped around one product goal: Brain Trust must provide more value than opening one AI website while remaining understandable to non-technical users.

### User-facing answer experience
- Full Debate, Masked Debate and Final Answer Only modes.
- Masked mode keeps visible activity as stars without exposing the text.
- Final synthesis is a separate real model call over completed panel contributions.
- Clean Reader View presents the final answer as a large paragraph-friendly page.

### Intelligence and cost discipline
- Requested free-model identity must match the API-returned model.
- Intelligence Fund support is separate from ordinary donations.
- Marginal Intelligence Budget favors free/local baseline, cheap checking, specialist escalation and one premium judge only when justified.
- Automatic paid spending stays off by default.

### Mission Control / owner operations
- Doctor health overview.
- Cost/Budget surface.
- Audit history.
- Safe deployment / rollback visibility for permitted roles.
- Existing transcript exporter surfaced in Mission Control.
- One-click guest invite copy/share.
- Registration status reconciliation.

### IRC
- Live Node relay gains CService-gated `!usrctrl` commands.
- Admin results and access codes are private notices.
- Tournament seats no longer silently impersonate failed providers through fallbacks.

### Safety gate
- Existing tests remain in the workflow.
- New master-upgrade tests cover synthesis, identity, visibility modes, Intelligence Fund guardrails, owner operations and IRC control.

Production is unchanged until checks/preview pass and the owner explicitly approves merge.

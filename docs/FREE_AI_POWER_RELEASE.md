# Brain Trust — Free AI Power release, 14 October 2026

The default chat mode calls three distinct zero-priced OpenRouter model families. Each response shows the model actually returned by the API. The roster discovers current free models, permits selection of up to four, and checks pricing again server-side before inference. Prompt, completion, request, image, search and reasoning charges must be zero when listed. The provider request also limits prompt/completion prices to zero. Shared OpenRouter quotas still apply; this does not create unlimited capacity or separate provider accounts.

Native mode preserves the existing provider connections. Cross-provider seat substitution has been removed. An explicitly addressed native provider uses its native route; it cannot silently answer as another company. Gemini may still retry a different Gemini model, truthfully attributed.

The six-face cube, existing Webb imagery, channel logs, settings, authentication, and IRC bridge are retained. Added: free model roster and attribution, provider-colored starfield cards, blue action buttons, observatory image inspection and target tour, HUNT/Catfish/relay ASCII launch controls, and browser-local image-to-ASCII download. Relay command execution itself was not verified in this session; it depends on the existing trusted host and command configuration.

## Verification

- 16 unit checks passed, covering free price validation, model allowlisting and attribution, native provider failures, chat-face rendering and archived log export.
- Mobile Chromium checks passed: all six animated sectors; three separate model calls and actual-model labels; roster selection; tool bay; audio player; image inspection, target switching and tour; no JavaScript page errors or horizontal page overflow. Provider responses in these browser checks were simulated.
- The first production build independently made live calls through the configured OpenRouter connection. Dots Studio dots-3-note-preview:free, Liquid lfm-2.5-2.6b:free, and NVIDIA nemotron-3.5-lightning:free answered correctly. Thinking Machines inkling-small:free returned HTTP 403. The three passing models comprise the initial default roster. A deployment-specific free-power-health.json records fresh build checks; availability can change.
- Production API access remains protected by existing application sessions. No production login session was available for a signed-in browser test.

## Preservation and rollback

The exact pre-upgrade cube source is in Brain_Trust_Backup_2026-10-14.zip. Cube deployment: dpl_2dfLGeDj2r96d1dgV3WAiifHvALR, https://ai-tournament-qa7ga2tv0-kayoskaide.vercel.app. Previous production: dpl_9Wc45Q9Ezwh7GxrCNrAnkLPDWKyN, GitHub main 97f59178fc3ec2f9236f9546c873528d50e9e435.

The GitHub integration initially returned HTTP 403 because its GitHub App had not been installed. Kyle completed the installation with code write access on 14 October 2026. The follow-up sync preserves a backup branch and synchronizes this source to the repository. The checked-in Vercel build configuration reproduces the live release and its free-model health checks.

No provider secrets are included in the source package. Use the existing project environment on redeployment. Build command: node scripts/verify-free-power.mjs. Output directory: . (root). There are still eleven API entry points; the new free-power handler is dispatched through the authenticated gate.

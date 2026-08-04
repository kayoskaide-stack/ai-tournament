# AI Tournament v1.0

Mobile-first AI game-show tournament.

## Deploy
Upload ALL files and folders in this package to the root of the GitHub repository connected to Vercel.

## Optional real AI connectors
The app works immediately in simulation mode.

For real contestants, add private Vercel Environment Variables:
- OPENAI_API_KEY
- GEMINI_API_KEY
- ANTHROPIC_API_KEY
- XAI_API_KEY

Optional:
- OPENAI_MODEL
- XAI_MODEL

Never put API keys in index.html or app.js.

After adding keys in Vercel, redeploy and turn on "Real AI mode" under Settings.

Duck currently acts as the built-in simulated speed contestant; it does not require a key.

https://agents-playground.livekit.io/

pnpm dev

## Preview Deployments

All preview deployments are coordinated via a unified GitHub Action workflow.
See `.github/workflows/preview-deploy.yml` for details.

The workflow triggers on PRs that modify:
- `packages/holaaiconvex/**` (Convex backend)
- `packages/livekit-voice-agent/**` (LiveKit Voice Agent)
- `apps/lifeos/taurireact-macapp/**` (LifeOS web app)

### What gets deployed:

1. **Convex Preview** (first, as dependency for others)
   - Deploys using `CONVEX_PREVIEW_DEPLOY_KEY`
   - Creates a preview named after the branch (sanitized)
   - Outputs the preview URL for other services

2. **Vercel Preview** (LifeOS web app)
   - Builds with `VITE_CONVEX_URL` pointing to Convex preview
   - Deploys via Vercel CLI

3. **Dokploy Preview** (LiveKit Voice Agent)
   - Updates `previewEnv` with Convex preview URL
   - Dokploy auto-creates the preview deployment

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `CONVEX_PREVIEW_DEPLOY_KEY` | Convex preview deploy key |
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_TAURI_LIFEOSAPP_PROJECT_ID` | Vercel project ID |
| `DOKPLOY_API_TOKEN` | Dokploy API token |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `OPENAI_API_KEY` | OpenAI API key |

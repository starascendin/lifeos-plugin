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
   - GitHub Action updates `previewEnv` with correct Convex URL
   - GitHub Action adds `deploy-preview` label to the PR
   - Dokploy sees the label and creates preview with correct env

### Dokploy Configuration (IMPORTANT)

Dokploy must be configured to use **label filtering** for preview deployments.
This breaks the race condition where Dokploy would create previews before GitHub Actions can set the correct `previewEnv`.

**To configure in Dokploy UI:**
1. Go to the application settings in Dokploy
2. Navigate to Preview Deployments settings
3. Add `deploy-preview` to the required labels list
4. Ensure `autoDeploy` is enabled (already done via API)

This ensures:
- PR created → Dokploy sees no label → waits
- GitHub Action runs → deploys Convex → updates previewEnv → adds label
- Dokploy sees label → creates preview with CORRECT CONVEX_URL ✅

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

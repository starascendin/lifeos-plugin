https://agents-playground.livekit.io/

pnpm dev

## Preview Deployments

Dokploy preview deployments are automatically synced with Convex preview URLs via GitHub Action.
See `.github/workflows/dokploy-preview-sync.yml` for details.

The workflow:
1. Deploys a Convex preview using `CONVEX_PREVIEW_DEPLOY_KEY`
2. Gets the Convex preview URL from the deployment output
3. Updates Dokploy's `previewEnv` with the Convex preview URL
4. Comments on the PR with the configuration

When a PR modifies `packages/livekit-voice-agent/**`, the workflow triggers and configures
Dokploy previews to use the corresponding Convex preview backend.

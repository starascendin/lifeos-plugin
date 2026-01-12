https://agents-playground.livekit.io/

pnpm dev

## Preview Deployments

Dokploy preview deployments are automatically synced with Convex preview URLs via GitHub Action.
See `.github/workflows/dokploy-preview-sync.yml` for details.

The workflow:
1. Waits for Vercel deployment to complete
2. Extracts the Convex preview URL from Vercel deployment env vars
3. Updates Dokploy's `previewEnv` with the correct Convex URL
4. Comments on the PR with the configuration

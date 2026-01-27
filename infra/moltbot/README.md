# Moltbot Deployment

Secure deployment of [moltbot](https://github.com/moltbot/moltbot) on K3s with Kata Containers + Firecracker isolation.

## Security

This deployment uses `kata-fc` RuntimeClass which runs the container inside a Firecracker microVM. This provides hardware-level isolation, making it safe to let the AI run freely.

## Persistence

Two PVCs are created:
- **moltbot-state** (1Gi) - `~/.clawdbot/` containing:
  - `moltbot.json` - main config
  - `credentials/oauth.json` - OAuth tokens (Anthropic subscription)
  - `agents/*/auth-profiles.json` - API keys entered during onboarding
  - Session transcripts
- **moltbot-workspace** (5Gi) - `~/clawd/` containing:
  - `AGENTS.md`, `SOUL.md`, `USER.md` - agent personality
  - `memory/` - daily memory logs

## Quick Start

### 1. Build and push the image

```bash
make build-push
```

### 2. Deploy

```bash
make deploy
```

### 3. Run onboarding (first time)

Shell into the pod and run the onboarding wizard:

```bash
make shell
moltbot onboard
```

The wizard will guide you through:
- Logging into your Anthropic subscription (Claude Pro/Max)
- Or entering API keys
- Configuring the workspace

All credentials are persisted to the PVC.

### 4. Check status

```bash
make status
make logs
```

## Gateway Access

The gateway runs on port 18789 inside the cluster. To access locally:

```bash
kubectl -n moltbot port-forward svc/moltbot 18789:18789
```

Then open http://localhost:18789

## Debugging

```bash
# Shell into the pod
make shell

# Check moltbot version
moltbot --version

# Re-run onboarding if needed
moltbot onboard --reset
```

## Cleanup

```bash
make clean
```

**Note**: This also deletes the PVCs. Your credentials and workspace will be lost.

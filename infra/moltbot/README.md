# Moltbot Deployment

Secure deployment of [moltbot](https://github.com/moltbot/moltbot) on K3s with Kata Containers + Firecracker isolation.

## Security

This deployment uses `kata-fc` RuntimeClass which runs the container inside a Firecracker microVM. This provides hardware-level isolation, making it safe to let the AI run freely.

## Quick Start

### 1. Build and push the image

```bash
make build-push
```

### 2. Configure secrets

Edit `k8s/secrets.yaml` with your API keys, or use sealed-secrets:

```bash
# Using sealed-secrets (recommended)
kubectl create secret generic moltbot-secrets \
  --namespace=moltbot \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-xxx \
  --from-literal=OPENAI_API_KEY=sk-xxx \
  --dry-run=client -o yaml | \
  kubeseal --format yaml > k8s/sealed-secrets.yaml
```

### 3. Deploy

```bash
make deploy
```

### 4. Check status

```bash
make status
make logs
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models |
| `OPENAI_API_KEY` | OpenAI API key (optional) |

### Resource Limits

Default limits are conservative. Adjust in `k8s/deployment.yaml`:
- CPU: 100m request, 1000m limit
- Memory: 256Mi request, 1Gi limit

## Debugging

```bash
# Shell into the pod
make shell

# Check moltbot version
kubectl -n moltbot exec deployment/moltbot -- moltbot --version
```

## Cleanup

```bash
make clean
```

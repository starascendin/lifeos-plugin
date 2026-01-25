# Claude Code Max Agent Farm

A self-hosted system for running multiple isolated Claude Code CLI instances as autonomous coding agents on Hetzner Cloud with K3s, Kata/Firecracker microVMs, and a mobile-first Go control plane.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Hetzner Cloud                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Master     │  │   Worker 1   │  │   Worker 2   │      │
│  │   CX22       │  │   CX32       │  │   CX32       │      │
│  │   4GB RAM    │  │   8GB RAM    │  │   8GB RAM    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                     K3s Cluster                             │
│                           │                                 │
│    ┌──────────────────────┴──────────────────────┐         │
│    │                                              │         │
│    │  ┌─────────────┐    ┌─────────────────┐     │         │
│    │  │  Control    │    │  Agent Pods     │     │         │
│    │  │  Plane      │    │  (Kata/FC)      │     │         │
│    │  │  (Go+HTMX)  │    │                 │     │         │
│    │  └─────────────┘    └─────────────────┘     │         │
│    │          │                   │              │         │
│    │          └───────┬───────────┘              │         │
│    │                  │                          │         │
│    │          ┌───────┴───────┐                  │         │
│    │          │  NFS Storage  │                  │         │
│    │          │  (credentials)│                  │         │
│    │          └───────────────┘                  │         │
│    └─────────────────────────────────────────────┘         │
│                                                             │
│                      Tailscale Mesh                         │
└─────────────────────────────────────────────────────────────┘
                            │
                     ┌──────┴──────┐
                     │   iPhone    │
                     │   (HTMX UI) │
                     └─────────────┘
```

## Monthly Cost

| Resource | Spec | Cost |
|----------|------|------|
| Master Node | CX22 (2 vCPU, 4GB) | €6.49 |
| Worker Node 1 | CX32 (4 vCPU, 8GB) | €10.99 |
| Worker Node 2 | CX32 (4 vCPU, 8GB) | €10.99 |
| **Total** | | **€28.47/mo** |

## Quick Start

### Prerequisites

1. Install hetzner-k3s CLI:
   ```bash
   brew install vitobotta/tap/hetzner_k3s
   ```

2. Create SSH key:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/hetzner-k3s
   ```

3. Get credentials:
   - Hetzner Cloud API token from console.hetzner.cloud
   - Tailscale auth key from tailscale.com
   - GitHub PAT with `repo` scope

4. Configure secrets:
   ```bash
   cp secrets/.env.example secrets/.env
   # Edit secrets/.env with your credentials
   source secrets/.env
   ```

### Deploy Cluster

```bash
# Create cluster
hetzner-k3s create --config cluster.yaml

# Configure kubectl
export KUBECONFIG=./kubeconfig

# Verify nodes
kubectl get nodes
```

### Setup Runtime & Storage

```bash
# Apply namespaces
kubectl apply -f k8s/base/namespace.yaml

# Deploy NFS server
kubectl apply -f k8s/storage/nfs-server.yaml

# Wait for NFS to be ready
kubectl wait --for=condition=ready pod -l app=nfs-server -n storage

# Create credentials PVC
kubectl apply -f k8s/storage/claude-credentials-pvc.yaml

# Deploy Kata containers
kubectl apply -f k8s/base/kata-deploy.yaml

# Label workers for Kata
kubectl label nodes <worker1> kata-fc=true kata-qemu=true
kubectl label nodes <worker2> kata-fc=true kata-qemu=true
```

### Build & Push Images

```bash
# Login to GHCR
echo $GITHUB_PAT | docker login ghcr.io -u $GHCR_USERNAME --password-stdin

# Build agent image
docker build -t ghcr.io/starascendin/claude-agent:latest ./agent
docker push ghcr.io/starascendin/claude-agent:latest

# Build control plane
cd controlplane
docker build -t ghcr.io/starascendin/claude-controlplane:latest .
docker push ghcr.io/starascendin/claude-controlplane:latest
cd ..
```

### Deploy Control Plane

```bash
# Create GitHub secrets
kubectl create secret generic github-credentials \
  --from-literal=GITHUB_PAT=$GITHUB_PAT

kubectl create secret docker-registry ghcr-credentials \
  --docker-server=ghcr.io \
  --docker-username=$GHCR_USERNAME \
  --docker-password=$GITHUB_PAT

# Copy secrets to namespaces
kubectl get secret ghcr-credentials -o yaml | \
  sed 's/namespace: default/namespace: claude-agents/' | \
  kubectl apply -f -

kubectl get secret ghcr-credentials -o yaml | \
  sed 's/namespace: default/namespace: controlplane/' | \
  kubectl apply -f -

# Deploy control plane
kubectl apply -f k8s/controlplane/rbac.yaml
kubectl apply -f k8s/controlplane/deployment.yaml
```

### One-Time Claude Login

```bash
# Deploy login pod
kubectl apply -f k8s/utils/login-pod.yaml

# Exec into pod
kubectl exec -it claude-login -- bash

# Inside pod: run login
claude /login

# Complete OAuth in browser, then exit
exit

# Clean up login pod
kubectl delete pod claude-login
```

### Access Control Plane

Access via Tailscale IP on port 30080:
```
http://100.x.x.x:30080
```

## Project Structure

```
k3s-rj-army/
├── cluster.yaml                 # Hetzner K3s cluster config
├── secrets/.env                 # Local secrets (gitignored)
├── agent/
│   ├── Dockerfile              # Claude CLI agent image
│   └── scripts/
│       ├── entrypoint.sh       # Agent startup script
│       └── clone-repos.sh      # Repository cloning
├── controlplane/
│   ├── Dockerfile              # Control plane image
│   ├── cmd/controlplane/       # Go entry point
│   ├── internal/
│   │   ├── handlers/           # HTTP handlers
│   │   ├── k8s/               # K8s client
│   │   ├── models/            # Data models
│   │   └── storage/           # SQLite store
│   └── web/templates/          # HTMX templates
├── k8s/
│   ├── base/                   # Core manifests
│   ├── storage/                # NFS & PVC
│   ├── controlplane/           # Control plane deploy
│   └── utils/                  # Test pods, login pod
└── scripts/                    # Setup scripts for nodes
```

## Features

- **Mobile-First UI**: HTMX + DaisyUI responsive dashboard
- **Agent Configs**: Save and reuse agent configurations
- **One-Tap Launch**: Launch agents from saved configs
- **Live Logs**: SSE streaming of agent output
- **Isolated Execution**: Each agent runs in Kata/Firecracker microVM
- **Shared Credentials**: Claude login persists via NFS

## Verification Checklist

- [ ] Cluster: 3 nodes Ready, Tailscale connected
- [ ] Runtime: kata-fc RuntimeClass works (`kubectl get runtimeclass`)
- [ ] Storage: NFS PVC accessible from multiple pods
- [ ] Agent Image: Builds and runs locally
- [ ] Control Plane: Dashboard loads on phone
- [ ] E2E: Launch agent, view logs, stop agent

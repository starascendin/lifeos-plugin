# RJ AI Army - Claude Agent Farm Architecture

## Overview

RJ AI Army is a self-hosted system for running multiple isolated Claude Code Max CLI instances as autonomous coding agents. Built on Hetzner Cloud with K3s, Kata/Firecracker microVMs, and a mobile-first Go control plane.

**Monthly Cost:** ~€28-40 (1 master + 2 workers)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Tailscale Mesh                                  │
│  (Secure access from any device - laptop, phone, etc.)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Hetzner Cloud (fsn1)                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  Master (CX11)  │    │  Worker (CX32)  │    │  Worker (CX32)  │         │
│  │  2 vCPU, 4GB    │    │  4 vCPU, 8GB    │    │  4 vCPU, 8GB    │         │
│  │                 │    │  + Kata/FC      │    │  + Kata/FC      │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│           │                      │                      │                   │
│           └──────────────────────┴──────────────────────┘                   │
│                              K3s Cluster                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Control Plane (Go + HTMX)

A lightweight web application for managing agents from any device.

**Stack:**
- Echo v4 (HTTP framework)
- SQLite (agent configs)
- HTMX + Tailwind + DaisyUI (mobile-first UI)
- Server-Sent Events (log streaming, interactive chat)

**Features:**
- Dashboard showing running agents
- Agent configuration CRUD
- One-tap agent launch
- Real-time log streaming
- Interactive Claude chat with markdown rendering

**Access:** `http://<tailscale-ip>:30080`

### 2. Agent Containers

Disposable pods running Claude Code CLI and OpenCode CLI in autonomous mode.

**Image:** `ghcr.io/starascendin/claude-agent:latest`

```dockerfile
Base: node:20-slim
├── Claude Code CLI (/home/node/.local/bin/claude)
├── OpenCode CLI (/home/node/.opencode/bin/opencode)
├── Git, curl, jq, openssh
├── entrypoint.sh (credential linking + repo cloning)
└── Non-root user (node, UID 1000)
```

**Lifecycle:**
1. Control plane creates pod with task prompt
2. Init container clones specified repos
3. Entrypoint links shared credentials
4. Claude CLI runs with `--dangerously-skip-permissions`
5. Agent completes task or hits budget limit
6. Pod terminates (or can be stopped manually)

### 3. Kata/Firecracker Runtime

VM-level isolation for untrusted code execution.

```
┌─────────────────────────────────────────┐
│           Worker Node                    │
│  ┌─────────────────────────────────────┐│
│  │     Firecracker MicroVM (~10MB)     ││
│  │  ┌────────────────────────────────┐ ││
│  │  │       Agent Container          │ ││
│  │  │  ┌──────────────────────────┐  │ ││
│  │  │  │     Claude CLI           │  │ ││
│  │  │  │  (code execution here)   │  │ ││
│  │  │  └──────────────────────────┘  │ ││
│  │  └────────────────────────────────┘ ││
│  └─────────────────────────────────────┘│
│  RuntimeClass: kata-fc                   │
└─────────────────────────────────────────┘
```

**Why microVMs?**
- Claude agents execute arbitrary code
- Container escape exploits can't reach host kernel
- ~125ms boot time, minimal overhead

---

## The Shared Storage Problem (and Solution)

### The Problem: CLI Credentials

Both Claude Code CLI and OpenCode CLI use local credentials:
- **Claude:** OAuth tokens in `~/.claude/`
- **OpenCode:** API keys in `~/.local/share/opencode/auth.json`, config in `~/.config/opencode/`

These credentials:
- Are created via interactive login flows (`claude /login`, `opencode auth login`)
- Need to be shared across ALL agent pods
- Must persist across pod restarts
- Can't be easily extracted/injected as environment variables

**Hetzner's limitation:** No managed NFS or shared filesystem service. Unlike AWS EFS or GCP Filestore, you can't just provision "shared storage" from the console.

### Failed Approaches

1. **HostPath volumes:** Only works if all pods land on the same node. No scheduling flexibility.

2. **ConfigMaps/Secrets:** Claude credentials are binary blobs with complex structure. Can't easily template them.

3. **Longhorn/Rook-Ceph:** Overkill complexity for simple credential sharing. High resource overhead.

### Our Solution: Containerized NFS Server

We run our own NFS server as a Kubernetes pod, backed by local storage.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Storage Architecture                              │
│                                                                              │
│  ┌────────────────────┐                                                     │
│  │   Worker Node      │                                                     │
│  │  ┌──────────────┐  │                                                     │
│  │  │ Local Disk   │  │                                                     │
│  │  │ (Hetzner VM) │  │                                                     │
│  │  └──────┬───────┘  │                                                     │
│  └─────────┼──────────┘                                                     │
│            │ local-path StorageClass                                        │
│            ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    NFS Server Pod (storage namespace)                │    │
│  │  Image: erichough/nfs-server:latest                                  │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐│    │
│  │  │ /exports (mounted from 20GB PVC)                                ││    │
│  │  │   ├── .claude/                                                  ││    │
│  │  │   │     ├── credentials.json                                    ││    │
│  │  │   │     └── settings.json                                       ││    │
│  │  │   ├── .local/share/opencode/                                    ││    │
│  │  │   │     ├── auth.json                                           ││    │
│  │  │   │     └── mcp-auth.json                                       ││    │
│  │  │   └── .config/opencode/                                         ││    │
│  │  │         └── opencode.json                                       ││    │
│  │  └─────────────────────────────────────────────────────────────────┘│    │
│  │  Service IP: 10.43.101.214:2049 (NFS)                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│            │                                                                 │
│            │ NFS Protocol (ReadWriteMany)                                   │
│            ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │              PersistentVolume: claude-credentials-pv                 │    │
│  │  StorageClass: nfs                                                   │    │
│  │  AccessMode: ReadWriteMany                                           │    │
│  │  Capacity: 1GB                                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│            │                                                                 │
│            │ PVC: claude-credentials                                        │
│            ▼                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Login Pod   │  │ Agent Pod 1 │  │ Agent Pod 2 │  │ Agent Pod N │        │
│  │ (RW - once) │  │ (RO mount)  │  │ (RO mount)  │  │ (RO mount)  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How It Works

**1. NFS Server Deployment (`k8s/storage/nfs-server.yaml`)**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nfs-server
  namespace: storage
spec:
  template:
    spec:
      containers:
        - name: nfs-server
          image: erichough/nfs-server:latest
          securityContext:
            privileged: true  # Required for NFS kernel modules
          env:
            - name: NFS_EXPORT_0
              value: "/exports *(rw,sync,no_subtree_check,no_root_squash)"
          volumeMounts:
            - name: nfs-data
              mountPath: /exports
      volumes:
        - name: nfs-data
          persistentVolumeClaim:
            claimName: nfs-backing-storage  # 20GB local-path PVC
```

**2. NFS-Backed PV & PVC (`k8s/storage/claude-credentials-pvc.yaml`)**

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: Immediate
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: claude-credentials-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteMany  # Key: Multiple pods can mount simultaneously
  nfs:
    server: 10.43.101.214  # NFS server ClusterIP
    path: /exports
  persistentVolumeReclaimPolicy: Retain
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: claude-credentials
  namespace: claude-agents
spec:
  storageClassName: nfs
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 1Gi
```

**3. One-Time Login Flow**

```bash
# Deploy login pod
kubectl apply -f k8s/utils/cli-login-pod.yaml

# Exec into it
kubectl exec -it cli-login -- bash

# Complete Claude OAuth flow
claude /login
# Opens browser, complete auth, tokens saved to ~/.claude

# Complete OpenCode login (optional)
opencode auth login
# Enter API keys for desired providers (OpenAI, Anthropic, etc.)

# Exit and delete pod - credentials persist in NFS
exit
kubectl delete pod cli-login
```

**4. Agent Credential Linking (`agent/scripts/entrypoint.sh`)**

```bash
#!/bin/bash
# Link shared Claude credentials
if [ -d "/credentials/.claude" ]; then
    rm -rf ~/.claude
    ln -sf /credentials/.claude ~/.claude
    echo "Linked shared Claude credentials"
fi

# Link shared OpenCode credentials
if [ -d "/credentials/.local/share/opencode" ]; then
    mkdir -p ~/.local/share
    ln -sf /credentials/.local/share/opencode ~/.local/share/opencode
    echo "Linked shared OpenCode credentials"
fi

# Link shared OpenCode config
if [ -d "/credentials/.config/opencode" ]; then
    mkdir -p ~/.config
    ln -sf /credentials/.config/opencode ~/.config/opencode
    echo "Linked shared OpenCode config"
fi

# Clone repos, build command, run Claude/OpenCode...
```

### Why This Works Well

| Aspect | Benefit |
|--------|---------|
| **ReadWriteMany** | Any number of pods can mount simultaneously |
| **Self-contained** | No external dependencies, runs entirely in K8s |
| **Persistent** | Credentials survive pod/node restarts |
| **Portable** | Works on any cloud or bare metal (not Hetzner-specific) |
| **Simple** | NFS is battle-tested, well-understood protocol |
| **Cost** | Zero additional cost - uses existing node disk |

### Limitations & Trade-offs

| Issue | Mitigation |
|-------|------------|
| **Single point of failure** | NFS pod crash = agents can't mount. Use deployment (not pod) for restart. |
| **No HA** | Could add multiple NFS servers with GlueFS, but overkill for credentials |
| **Token refresh race** | If multiple agents refresh tokens simultaneously, last writer wins. In practice, not an issue since refresh is rare. |
| **Node affinity** | NFS server must run on node with backing PVC. Use node selector or tolerate any node. |

---

## GitOps & Monitoring Stack

### ArgoCD

All manifests are managed via GitOps:

```
k8s/
├── apps/                          # ArgoCD Applications
│   ├── root.yaml                  # App-of-apps
│   ├── base.yaml
│   ├── storage.yaml
│   ├── controlplane.yaml
│   └── monitoring.yaml
├── infrastructure/
│   ├── argocd/                    # ArgoCD install
│   ├── sealed-secrets/            # Sealed secrets controller
│   └── monitoring/                # PrometheusRules
├── base/                          # Namespaces, RBAC, sealed secrets
├── storage/                       # NFS server, PVCs
├── controlplane/                  # Control plane deployment
└── utils/                         # Login pod, test pods
```

**Access:** `http://<tailscale-ip>:30880`

### Monitoring

- **Prometheus** - Metrics collection
- **Grafana** - Dashboards (port 30300)
- **Loki** - Log aggregation
- **Alertmanager** - Alert routing

**Custom Alerts (`k8s/infrastructure/monitoring/alerting-rules.yaml`):**
- Cluster health (CPU, memory, disk)
- Pod health (crash loops, not ready)
- Claude-specific (agent failures, chat pod status)
- Control plane availability
- Storage (NFS server, PVC capacity)

---

## Security Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Security Layers                                 │
│                                                                              │
│  1. Network: Tailscale VPN (no public IPs exposed)                          │
│     └── Only Tailscale mesh members can reach cluster                       │
│                                                                              │
│  2. Runtime: Kata Firecracker microVMs                                       │
│     └── VM-level isolation for agent code execution                         │
│     └── Container escape ≠ host compromise                                  │
│                                                                              │
│  3. RBAC: Minimal ServiceAccount permissions                                 │
│     └── Control plane can only manage claude-agents namespace               │
│     └── Agents have no K8s API access                                       │
│                                                                              │
│  4. Credentials: Read-only mounts in agents                                  │
│     └── Only login pod has write access                                     │
│     └── Agents can use but not modify OAuth tokens/API keys                 │
│                                                                              │
│  5. AI CLIs: Tool allowlists + budget limits                                │
│     └── ALLOWED_TOOLS restricts what Claude/OpenCode can execute            │
│     └── MAX_BUDGET_USD caps spending                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Operational Runbook

### Initial Setup

```bash
# 1. Create cluster
hetzner-k3s create --config cluster.yaml
export KUBECONFIG=./kubeconfig

# 2. Deploy infrastructure
kubectl apply -k k8s/infrastructure/argocd
kubectl apply -k k8s/infrastructure/sealed-secrets

# 3. Deploy applications via ArgoCD
kubectl apply -f k8s/apps/root.yaml

# 4. One-time credential setup
kubectl apply -f k8s/utils/cli-login-pod.yaml
kubectl exec -it cli-login -- claude /login
kubectl exec -it cli-login -- opencode auth login  # Optional
kubectl delete pod cli-login
```

### Common Operations

```bash
# View running agents
kubectl get pods -n claude-agents -l app=claude-agent

# Stream agent logs
kubectl logs -f <pod-name> -n claude-agents

# Stop an agent
kubectl delete pod <pod-name> -n claude-agents

# Check NFS server health
kubectl get pods -n storage
kubectl logs -f nfs-server-xxx -n storage

# Reseal a secret after editing
kubeseal --cert secrets/sealed-secrets-pub.pem \
    -o yaml < secrets/my-secret.yaml > k8s/base/sealed-secrets/my-secret.yaml
```

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Agent pod stuck in Pending | NFS server down | Check `kubectl get pods -n storage` |
| "No such file: ~/.claude" | Credentials not linked | Verify PVC mount, check entrypoint logs |
| Agent immediate exit | Invalid task prompt or auth failure | Check agent logs, verify OAuth tokens |
| Kata runtime not found | DaemonSet not deployed | `kubectl apply -f k8s/base/kata-deploy.yaml` |
| Control plane 502 | Pod crashed | Check `kubectl get pods -n controlplane` |

---

## Cost Breakdown

| Component | Spec | Monthly Cost |
|-----------|------|--------------|
| Master | CX11 (2 vCPU, 4GB) | €4.49 |
| Worker 1 | CX32 (4 vCPU, 8GB) | €10.99 |
| Worker 2 | CX32 (4 vCPU, 8GB) | €10.99 |
| IPv4 | Included | €0 |
| **Total** | | **€26.47** |

Storage uses local disk (included). Tailscale free tier is sufficient.

---

## Future Improvements

- [ ] NFS HA with GlusterFS or similar (if credential loss becomes painful)
- [ ] Alertmanager integration (Slack/Discord notifications)
- [ ] Agent result persistence (save outputs to S3/R2)
- [ ] Multi-cluster support (run agents across regions)
- [ ] Credential refresh locking (distributed lock for token updates)

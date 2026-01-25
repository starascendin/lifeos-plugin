# RJ AI Army - Quick Reference Guide

## Access URLs (via Tailscale MagicDNS)

Once Tailscale is installed on your cluster nodes, you can access services via MagicDNS hostnames instead of raw IPs.

### Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Control Plane** | `http://claude-farm-master.tail05d28.ts.net:30080` | None (internal) |
| **ArgoCD** | `https://claude-farm-master.tail05d28.ts.net:30880` | admin / `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" \| base64 -d` |
| **Grafana** | `http://claude-farm-master.tail05d28.ts.net:30300` | admin / admin |
| **K8s API** | `https://claude-farm-master.tail05d28.ts.net:6443` | Use kubeconfig |

### Quick Links (copy-paste)

```
Control Plane:  http://claude-farm-master.tail05d28.ts.net:30080
ArgoCD:         https://claude-farm-master.tail05d28.ts.net:30880
Grafana:        http://claude-farm-master.tail05d28.ts.net:30300
```

---

## Port Reference

| Port | Service | Protocol |
|------|---------|----------|
| 30080 | Control Plane (Web UI) | HTTP |
| 30880 | ArgoCD (GitOps Dashboard) | HTTPS |
| 30300 | Grafana (Monitoring) | HTTP |
| 6443 | Kubernetes API | HTTPS |
| 2049 | NFS Server (internal) | NFS |

---

## Quick Commands

### Cluster Status

```bash
# Check nodes
kubectl get nodes

# Check all pods across namespaces
kubectl get pods -A

# Check running agents
kubectl get pods -n claude-agents -l app=claude-agent
```

### Agent Management

```bash
# Launch agent (via Control Plane UI recommended)
# Or manually:
kubectl apply -f k8s/utils/agent-pod-template.yaml

# Stream agent logs
kubectl logs -f <pod-name> -n claude-agents

# Stop an agent
kubectl delete pod <pod-name> -n claude-agents

# List all agents
kubectl get pods -n claude-agents
```

### Credential Management

```bash
# Re-login to Claude (if token expires)
kubectl apply -f k8s/utils/cli-login-pod.yaml
kubectl exec -it cli-login -n default -- bash
# Inside pod:
claude /login
# Complete OAuth flow, then:
exit
kubectl delete pod cli-login
```

### ArgoCD

```bash
# Get ArgoCD admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo

# Check sync status
kubectl get applications -n argocd

# Force sync an app
argocd app sync <app-name>
```

### Monitoring

```bash
# Check Prometheus targets
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
# Then open http://localhost:9090/targets

# Check Grafana dashboards
# Access via http://k3s-rj-army:30300

# View logs via Loki (in Grafana)
# Data source: Loki, query: {namespace="claude-agents"}
```

### Storage / NFS

```bash
# Check NFS server
kubectl get pods -n storage -l app=nfs-server

# Check credentials PVC
kubectl get pvc -n claude-agents

# Test NFS mount
kubectl apply -f k8s/utils/nfs-test-pod.yaml
kubectl exec -it nfs-test -n default -- ls -la /mnt/nfs
```

---

## GitOps Workflow

All changes to the cluster should go through Git:

```
1. Edit manifests in k8s/
2. Commit & push to main
3. ArgoCD auto-syncs (or manually sync)
```

### Image Updates (CI/CD)

When you push code changes:
1. GitHub Actions builds new images
2. Images pushed to `ghcr.io/starascendin/claude-agent-farm-*`
3. ArgoCD Image Updater detects new tags
4. Deployments auto-updated with new image

### Manual Image Update

```bash
# Force pull latest image
kubectl rollout restart deployment/controlplane -n controlplane
```

---

## Troubleshooting

### Agent Pod Stuck in Pending

```bash
# Check events
kubectl describe pod <pod-name> -n claude-agents

# Common causes:
# - NFS server down: kubectl get pods -n storage
# - No nodes available: kubectl get nodes
# - Image pull error: check ghcr-credentials secret
```

### Control Plane Not Loading

```bash
# Check pod status
kubectl get pods -n controlplane

# Check logs
kubectl logs -f deployment/controlplane -n controlplane

# Restart
kubectl rollout restart deployment/controlplane -n controlplane
```

### ArgoCD Sync Failed

```bash
# Check app status
kubectl get applications -n argocd

# View detailed status
argocd app get <app-name>

# Check argocd logs
kubectl logs -n argocd deployment/argocd-application-controller
```

### NFS Issues

```bash
# Check NFS server is running
kubectl get pods -n storage -l app=nfs-server

# Check NFS server logs
kubectl logs -n storage deployment/nfs-server

# Verify PV is bound
kubectl get pv claude-credentials-pv
```

---

## Secrets Management

Secrets are managed via SealedSecrets. To update a secret:

```bash
# 1. Create the plain secret YAML (don't commit this!)
cat > /tmp/my-secret.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  namespace: default
type: Opaque
stringData:
  KEY: "value"
EOF

# 2. Seal it
kubeseal --cert secrets/sealed-secrets-pub.pem \
  -o yaml < /tmp/my-secret.yaml > k8s/base/sealed-secrets/my-secret.yaml

# 3. Commit the sealed secret
git add k8s/base/sealed-secrets/my-secret.yaml
git commit -m "Add my-secret sealed secret"
git push

# 4. ArgoCD will apply it
```

---

## Cost Summary

| Component | Spec | Monthly |
|-----------|------|---------|
| Master | CPX11 (2 vCPU, 4GB) | ~€5 |
| Workers | CX32 x2 (optional) | ~€22 |
| **Total** | | **€5-27/mo** |

---

## Useful Links

- **GitHub Repo**: https://github.com/starascendin/claude-agent-farm
- **Container Registry**: https://ghcr.io/starascendin
- **Hetzner Console**: https://console.hetzner.cloud
- **Tailscale Admin**: https://login.tailscale.com/admin

---

## Architecture Diagram

```
                    ┌──────────────────────────────────────┐
                    │           Tailscale Mesh             │
                    │  claude-farm-master.tail05d28.ts.net │
                    └──────────────────┬───────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                               │
        ▼                              ▼                               ▼
   :30080                         :30880                          :30300
┌─────────────┐              ┌─────────────┐                 ┌─────────────┐
│  Control    │              │   ArgoCD    │                 │   Grafana   │
│   Plane     │              │   (GitOps)  │                 │ (Monitoring)│
└─────────────┘              └─────────────┘                 └─────────────┘
        │
        │ launches
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         claude-agents namespace                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │ Agent Pod 1 │  │ Agent Pod 2 │  │ Agent Pod N │  (Kata/Firecracker) │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                     │
│         └────────────────┼────────────────┘                             │
│                          │                                               │
│                    NFS Mount (ReadOnly)                                  │
│                          │                                               │
│                  ┌───────┴───────┐                                       │
│                  │ claude-creds  │                                       │
│                  │     PVC       │                                       │
│                  └───────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

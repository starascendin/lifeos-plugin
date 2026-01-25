# Coder Setup Guide

## Overview

Coder provides self-hosted cloud development environments. This setup deploys Coder on your k3s cluster using ArgoCD.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     k3s Cluster                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   PostgreSQL    │  │     Coder       │                   │
│  │   (coder-db)    │◄─│   (Helm chart)  │                   │
│  │   Port: 5432    │  │   Port: 8080    │                   │
│  └─────────────────┘  └────────┬────────┘                   │
│                                │                             │
│  ┌─────────────────────────────┼─────────────────────────┐  │
│  │           Workspace Pods    │                          │  │
│  │  ┌──────────┐  ┌──────────┐ │  ┌──────────┐           │  │
│  │  │ dev-ws-1 │  │ dev-ws-2 │ │  │ dev-ws-n │           │  │
│  │  └──────────┘  └──────────┘ │  └──────────┘           │  │
│  └─────────────────────────────┼─────────────────────────┘  │
└────────────────────────────────┼─────────────────────────────┘
                                 │
                        NodePort :30700
                                 │
                            ┌────▼────┐
                            │  User   │
                            └─────────┘
```

## Prerequisites

1. k3s cluster running
2. ArgoCD installed and configured
3. Sealed Secrets controller (for production secrets)

## Deployment Steps

### 1. Update the Access URL

Edit `k8s/apps/coder.yaml` and replace `YOUR_SERVER_IP` with your Hetzner server IP:

```yaml
- name: CODER_ACCESS_URL
  value: "http://YOUR_SERVER_IP:30700"
```

### 2. Create Secure Database Password

For production, use Sealed Secrets:

```bash
# Generate a secure password
PASSWORD=$(openssl rand -base64 24)

# Create the secret
kubectl create secret generic coder-db-credentials \
  --from-literal=password="$PASSWORD" \
  --from-literal=url="postgres://coder:$PASSWORD@coder-postgres.coder.svc.cluster.local:5432/coder?sslmode=disable" \
  -n coder \
  --dry-run=client -o yaml | kubeseal -o yaml > k8s/coder/db-secret-sealed.yaml
```

Then update `k8s/coder/kustomization.yaml` to use the sealed secret.

### 3. Commit and Push

```bash
git add k8s/coder k8s/apps/coder.yaml k8s/apps/kustomization.yaml
git commit -m "Add Coder development environment"
git push
```

### 4. Wait for ArgoCD Sync

ArgoCD will automatically deploy:
1. `coder-base` - PostgreSQL, secrets, NodePort service
2. `coder` - Coder Helm chart

Check status:
```bash
kubectl get pods -n coder
kubectl get svc -n coder
```

### 5. Access Coder

Open in browser: `http://YOUR_SERVER_IP:30700`

Create the first admin user when prompted.

## Post-Installation

### Install Coder CLI

```bash
curl -L https://coder.com/install.sh | sh
```

### Login to Coder

```bash
coder login http://YOUR_SERVER_IP:30700
```

### Push the Kubernetes Template

```bash
cd k8s/coder/templates/kubernetes-dev
coder templates push kubernetes-dev --directory .
```

### Create a Workspace

```bash
coder create my-dev --template kubernetes-dev
```

### Connect VS Code

```bash
coder config-ssh
code --remote ssh-remote+coder.my-dev /home/coder
```

## Resource Limits

Default limits per workspace:
- CPU: 1 core (configurable: 0.5-4)
- Memory: 2GB (configurable: 1-8GB)
- Disk: 10GB (configurable: 10-50GB)

Adjust based on your cluster capacity.

## Troubleshooting

### Check Coder logs
```bash
kubectl logs -n coder -l app.kubernetes.io/name=coder -f
```

### Check PostgreSQL
```bash
kubectl logs -n coder -l app=coder-postgres -f
```

### Database connection issues
```bash
kubectl exec -n coder -it deploy/coder-postgres -- psql -U coder -d coder -c "SELECT 1"
```

### Workspace not starting
```bash
kubectl get pods -n coder
kubectl describe pod -n coder coder-<user>-<workspace>
```

# Personal Claude Code Max Agent Farm Specification

## Overview

This specification defines a self-hosted, secure, scalable system for running multiple isolated instances of the Claude Code Max CLI as autonomous coding agents. The system allows a single user (accessed primarily from an iPhone) to launch, configure, and manage an "army" of agents that share one Claude Code Max subscription while executing arbitrary/untrusted code in high-isolation microVMs.

The system is designed to be:
- **Cheap**: Run on low-cost Hetzner VMs (~€25–40/month total).
- **Secure**: VM-level isolation for untrusted code execution.
- **Simple**: Minimal components, custom lightweight UI.
- **Mobile-first**: Full control from iPhone browser via Tailscale.
- **Private**: No external services beyond Hetzner and Tailscale; all data and credentials stay in your control.

The user experience goal: Open browser on phone → secure Tailscale URL → clean dashboard → define/configure/launch agents with one tap → agents autonomously work on selected GitHub repos using shared Claude Max credentials.

## Goals

- Run multiple parallel Claude Code Max instances sharing one subscription (OAuth session).
- Each agent runs in its own Firecracker microVM for strong isolation against container escapes.
- Agents can clone and work on user-specified private GitHub repositories.
- Easy to launch, monitor, and terminate agents from a mobile-friendly web UI.
- Configurable agent templates that can evolve over time.
- Zero external orchestration tools (no Coder, no Argo, no external Git for templates).

## High-Level Architecture

```
iPhone Browser
    │ (Tailscale VPN)
    ▼
Tailscale Gateway → Custom Control Plane (Go + HTMX + Tailwind/DaisyUI)
    │                 (Runs as pod in cluster, exposes HTTP on Tailscale IP)
    ▼
Kubernetes API (K3s)
    │
    ├─► Creates/manages Agent Pods (Kata + Firecracker runtimeClass)
    │       ├─ Shared RWX Volume (NFS) → ~/.claude config (OAuth tokens)
    │       ├─ GitHub PAT Secret → git clone/push in initContainer
    │       └─ Per-pod working dir (emptyDir or local PV)
    │
    ▼
Hetzner VMs (3–5 nodes running K3s)
    └─ NFS server pod (for RWX shared credentials volume)
```

## Components

### 1. Infrastructure Layer (Hetzner + K3s)

- **Cluster**: K3s (lightweight Kubernetes) on 3–5 Hetzner Cloud VMs (e.g., CX21/CX31 series).
- **Runtime**: Kata Containers with Firecracker backend (`runtimeClassName: kata-firecracker`) for all agent pods → ~125 ms boot, low overhead, full VM isolation.
- **Networking**: Tailscale installed on all nodes + a gateway node. Expose control plane via Tailscale IP (e.g., 100.x.x.x:8080).
- **Shared Storage**:
  - One small NFS server pod (backed by Hetzner volume or local disk).
  - RWX PersistentVolumeClaim mounted at `/home/user/.claude` in every agent pod → shared OAuth config and token refresh.

### 2. Agent Runtime (Pods)

- Each agent is a Kubernetes Pod (or single-replica Deployment for restartability).
- Container image: Custom minimal image based on Ubuntu/Alpine with:
  - Claude Code CLI installed.
  - Git, basic tools.
- Pod spec features:
  - `runtimeClassName: kata-firecracker`
  - Mount shared RWX volume at Claude config path (read-write).
  - Mount GitHub PAT as secret env var or file.
  - InitContainer: `git clone` selected repos into working directory.
  - Main container entrypoint: Starts Claude Code CLI in agent mode (with user-defined prompt/system instructions).
  - Resources: Configurable CPU/memory per agent config.
- One-time setup: Launch one agent manually, run Claude Code `/login` → tokens saved to shared volume → all future agents inherit the session.

### 3. Control Plane (Custom Go Application)

- Single Go binary deployed as a Deployment pod.
- Tech stack:
  - Web framework: Echo or Chi (lightweight router).
  - Frontend: HTMX + Tailwind CSS + DaisyUI (CDN for simplicity).
  - Kubernetes interaction: `k8s.io/client-go` (in-cluster config).
- Features:
  - Mobile-responsive UI with sidebar (collapses to hamburger on phone).
  - Pages:
    - Dashboard: List running agents (name, status, start time, logs button).
    - Create/Edit Agent Config: Form with fields (name, description, repos list (comma-separated or multi-select), system prompt, resource limits, image version/tag).
    - Launch: Button to create pod from selected config.
    - Stop/Delete: Per-agent terminate.
    - Logs: Tail pod logs (via Kubernetes API streaming).
  - HTMX for dynamic updates (auto-refresh status, no full page reloads).
- Optional future: Wrap the web UI with Capacitor to make it a native iOS app (PWA + Capacitor for offline feel and home screen icon).

### 4. Configuration Storage

- Agent configurations stored as Kubernetes ConfigMaps (one per agent type) **or** a single SQLite database pod (persistent volume).
- Schema (start simple, evolve):
  ```json
  {
    "id": "python-bot-v1",
    "name": "Python Coding Agent",
    "description": "General Python helper",
    "repos": ["owner/repo1", "owner/repo2"],
    "system_prompt": "You are an expert Python developer...",
    "resources": {
      "cpu": "2",
      "memory": "4Gi"
    },
    "image_tag": "latest",
    "active": true
  }
  ```
- Control plane reads/writes these on create/edit.

### 5. Security & Secrets

- **Claude Credentials**: Shared via RWX volume (no Secret needed for config files).
- **GitHub PAT**: Stored as Kubernetes Secret, mounted as env var in agent pods.
- **Access Control**: Entire system behind Tailscale (zero public exposure).
- **Isolation**: Firecracker microVMs prevent container breakout even if agent generates malicious code.

## Deployment Steps (High-Level)

1. Provision Hetzner VMs → install K3s (use kube-hetzner or hetzner-k3s tool).
2. Install Kata Containers + Firecracker runtime.
3. Deploy NFS provisioner + shared PVC.
4. Create GitHub PAT Secret.
5. Build/deploy custom Go control plane image.
6. Install Tailscale → expose control plane port.
7. Launch first agent → complete Claude login → scale.

## Future Extensions

- Agent templates with versioning.
- Auto-scaling based on queue.
- Log aggregation.
- Agent-to-agent communication (if needed).
- Per-agent ephemeral storage for larger workspaces.

This spec is designed to be fed directly into Claude Code Max for implementation assistance (e.g., generating the Go code, pod YAML templates, or deployment scripts). Start with the control plane skeleton, then agent image, then infrastructure scripts.




Use https://github.com/vitobotta/hetzner-k3s
setup my k3s on hetzner
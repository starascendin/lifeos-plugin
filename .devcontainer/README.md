# Devcontainer for Claude Code Development

This devcontainer is configured for running Claude Code CLI in autonomous (yolo) mode while keeping your Mac host free for building Tauri and iOS apps.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Mac Host                                               │
│  ├── Build Tauri app (pnpm tauri build)                │
│  ├── Build iOS app (Xcode)                             │
│  └── Source code: ~/Sync/00.Projects/holaai-convexo...  │
│           │                                             │
│           │ (bind mount)                                │
│           ▼                                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Devcontainer                                    │  │
│  │  ├── Claude Code CLI (yolo mode)                 │  │
│  │  ├── Node 22 + pnpm                              │  │
│  │  ├── Source code at /workspace                   │  │
│  │  └── Claude creds at ~/.claude-shared (volume)   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

This devcontainer also isolates `/workspace/.pnpm-store` and all `node_modules` via Docker volumes so Linux installs can’t corrupt macOS installs in the bind-mounted repo.

## Quick Start

### 1. Open in Devcontainer

**VS Code:**
- Open Command Palette (`Cmd+Shift+P`)
- Select "Dev Containers: Reopen in Container"

**CLI (using devcontainer CLI):**
```bash
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

### 2. First-Time Claude Setup

Inside the devcontainer:

```bash
# Login to Claude (opens browser for OAuth)
claude login

# Save credentials to persistent volume
~/save-claude-auth.sh
```

### 3. Use Claude in Yolo Mode

```bash
# Start interactive session with auto-accept
claude --dangerously-skip-permissions

# Or run a specific task
claude -p "fix all typescript errors in the project" --dangerously-skip-permissions
```

## Credential Persistence

Credentials are stored in a Docker named volume: `claude-credentials-{your-username}`

This means:
- Credentials survive container rebuilds
- Credentials survive reopening the devcontainer
- Credentials are specific to your user (not shared)

### Files Persisted

| File | Purpose |
|------|---------|
| `~/.claude/.credentials.json` | OAuth tokens |
| `~/.claude.json` | Settings, MCP servers |
| `~/.claude/settings.json` | Additional settings |

### Manual Save/Restore

```bash
# Save current credentials
~/save-claude-auth.sh

# Restore happens automatically on container start
# But you can manually run:
bash /workspace/.devcontainer/restore-claude-auth.sh
```

## Host vs Container Tasks

| Task | Where | Command |
|------|-------|---------|
| Claude Code (yolo mode) | Container | `claude --dangerously-skip-permissions` |
| TypeScript/lint/test | Either | `pnpm typecheck`, `pnpm lint`, `pnpm test` |
| Tauri build (macOS) | **Host only** | `pnpm tauri build` |
| iOS build | **Host only** | Use Xcode |
| Convex deploy | Either | `npx convex dev --once` |

## Troubleshooting

### Claude says "not authenticated"

```bash
# Check if credentials exist
ls -la ~/.claude/
cat ~/.claude/.credentials.json | head -c 100

# If missing, login and save
claude login
~/save-claude-auth.sh
```

### Volume permissions issue

```bash
sudo chown -R vscode:vscode ~/.claude-shared
```

### Container not starting

Check Docker Desktop is running and has enough resources.

### Changes not syncing to host

The workspace is bind-mounted, so changes should sync instantly. If not:
```bash
# Check mount
mount | grep workspace
```

## Customization

### Add MCP Servers

```bash
# Inside devcontainer
claude mcp add <server-name> -- <command>

# Save the config
~/save-claude-auth.sh
```

### Modify Settings

Edit `.devcontainer/devcontainer.json` for:
- Additional port forwarding
- Environment variables
- VS Code extensions
- Additional features

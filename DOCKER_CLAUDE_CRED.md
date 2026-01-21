# Docker + Claude Code: Non-Coding Agent

Run Claude Code in a Docker container as a non-coding agent that works over MCP tools.

## Quick Start

```bash
# Build
docker build -t claude-agent -f Dockerfile.claude-agent .

# Run (interactive first time to login)
docker run -it --name claude-agent \
  -v claude-credentials:/home/node/.claude \
  -v claude-config:/home/node/.config \
  -v $(pwd)/mcp-config:/home/node/.claude/mcp \
  claude-agent bash

# Inside container: login once
claude login
# Complete OAuth in browser

# Exit and use non-interactively
exit
```

## Dockerfile.claude-agent

```dockerfile
FROM node:22-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl git jq \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user directories
RUN mkdir -p /home/node/.claude /home/node/.config \
    && chown -R node:node /home/node

USER node
WORKDIR /home/node

# Default to non-interactive mode
ENTRYPOINT ["claude"]
CMD ["--help"]
```

## Non-Interactive Usage

```bash
# Execute a prompt and get result
docker exec claude-agent claude \
  --dangerously-skip-permissions \
  -p "Use the weather MCP to get forecast for Tokyo"

# With print mode (just output, no interactive)
docker exec claude-agent claude \
  --dangerously-skip-permissions \
  --print \
  -p "Summarize my calendar for today using the calendar MCP"

# Pipe input
echo "What meetings do I have tomorrow?" | docker exec -i claude-agent claude \
  --dangerously-skip-permissions \
  --print
```

## Key Flags

| Flag | Purpose |
|------|---------|
| `--dangerously-skip-permissions` | Skip all permission prompts (YOLO mode) |
| `--print` or `-p` | Print response and exit (non-interactive) |
| `--output-format json` | JSON output for parsing |
| `--max-turns N` | Limit agentic turns |
| `--mcp-config <path>` | Custom MCP config file |

## MCP Configuration

Create `mcp-config/settings.json`:

```json
{
  "mcpServers": {
    "weather": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-weather"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/data"]
    },
    "custom-api": {
      "command": "node",
      "args": ["/home/node/mcp-servers/my-api-server.js"],
      "env": {
        "API_KEY": "your-key"
      }
    }
  }
}
```

Mount it:

```bash
docker run -it \
  -v claude-credentials:/home/node/.claude \
  -v $(pwd)/mcp-config/settings.json:/home/node/.claude/settings.json:ro \
  claude-agent
```

## Docker Compose

```yaml
version: '3.8'

services:
  claude-agent:
    build:
      context: .
      dockerfile: Dockerfile.claude-agent
    container_name: claude-agent
    volumes:
      - claude-credentials:/home/node/.claude
      - claude-config:/home/node/.config
      - ./mcp-config/settings.json:/home/node/.claude/settings.json:ro
      - ./data:/data  # For filesystem MCP
    stdin_open: true
    tty: true
    entrypoint: ["tail", "-f", "/dev/null"]  # Keep alive for exec

volumes:
  claude-credentials:
  claude-config:
```

Usage:

```bash
# Start container
docker compose up -d

# Execute commands
docker compose exec claude-agent claude \
  --dangerously-skip-permissions \
  --print \
  -p "Your prompt here"

# Stop
docker compose down
```

## Wrapper Script

Create `claude-run.sh` on host:

```bash
#!/bin/bash
# Usage: ./claude-run.sh "Your prompt here"

docker exec claude-agent claude \
  --dangerously-skip-permissions \
  --print \
  --output-format text \
  -p "$1"
```

Or for JSON output:

```bash
#!/bin/bash
# Usage: ./claude-run.sh "Your prompt" | jq '.result'

docker exec claude-agent claude \
  --dangerously-skip-permissions \
  --print \
  --output-format json \
  -p "$1"
```

## Credential Persistence

Credentials persist in Docker volumes:

```bash
# List volumes
docker volume ls | grep claude

# Credentials stored in:
# - claude-credentials:/home/node/.claude/.credentials.json (OAuth)
# - claude-config:/home/node/.config (settings)

# Backup credentials
docker run --rm -v claude-credentials:/data -v $(pwd):/backup \
  alpine tar czf /backup/claude-creds-backup.tar.gz -C /data .

# Restore credentials
docker run --rm -v claude-credentials:/data -v $(pwd):/backup \
  alpine tar xzf /backup/claude-creds-backup.tar.gz -C /data
```

## First-Time Login

```bash
# Start container with bash
docker run -it --name claude-agent \
  -v claude-credentials:/home/node/.claude \
  -v claude-config:/home/node/.config \
  claude-agent bash

# Login (opens browser URL)
claude login

# Verify
claude --version

# Exit - credentials now persisted in volume
exit

# Restart container for non-interactive use
docker start claude-agent
```

## Example: Non-Coding Agent Workflow

```bash
# 1. Query an API via MCP
./claude-run.sh "Use the jira MCP to list my open tickets"

# 2. Summarize data
./claude-run.sh "Use the database MCP to query sales from last month and summarize trends"

# 3. Multi-step task
./claude-run.sh "Check my calendar for tomorrow, then draft an email summary of my meetings"
```

## Troubleshooting

**"Not logged in":**
```bash
docker exec -it claude-agent claude login
```

**MCP not loading:**
```bash
# Check MCP config is mounted
docker exec claude-agent cat /home/node/.claude/settings.json

# Test MCP manually
docker exec claude-agent claude --print -p "List available MCP tools"
```

**Permission denied:**
```bash
# Fix volume permissions
docker exec -u root claude-agent chown -R node:node /home/node/.claude
```

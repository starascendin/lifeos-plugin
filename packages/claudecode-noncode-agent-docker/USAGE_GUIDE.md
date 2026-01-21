# Claude Code Docker Agent - Usage Guide

Run Claude Code in Docker as a non-coding agent with MCP tools.

## Setup

### 1. Build the image

```bash
docker build -t claude-agent -f Dockerfile.claude-agent .
```

### 2. Run the container

```bash
docker run -d --name claude-agent -v claude-credentials:/home/node/.claude -v claude-config:/home/node/.config -v $(pwd)/.mcp.json:/home/node/.mcp.json:ro claude-agent
```

### 3. First-time login

```bash
docker exec -it claude-agent claude login
```

Complete OAuth in browser. Credentials are saved to the `claude-credentials` volume.

### 4. Test it works

```bash
docker exec claude-agent claude --dangerously-skip-permissions --print -p "List my MCP tools"
```

## Usage

### Run a prompt

```bash
docker exec claude-agent claude --dangerously-skip-permissions --print -p "Your prompt here"
```

### Using the wrapper script

```bash
./claude-run.sh "Your prompt here"
```

## MCP Configuration

MCP config is mounted from `.mcp.json` in the project directory.

To modify MCP servers, edit `.mcp.json` - changes take effect on next command (no rebuild needed).

## Container Management

### Start/stop

```bash
docker stop claude-agent
docker start claude-agent
```

### Restart (clears stuck processes)

```bash
docker restart claude-agent
```

### Remove and recreate

```bash
docker rm -f claude-agent
docker run -d --name claude-agent -v claude-credentials:/home/node/.claude -v claude-config:/home/node/.config -v $(pwd)/.mcp.json:/home/node/.mcp.json:ro claude-agent
```

## Credentials

Credentials persist in Docker volumes:

- `claude-credentials` - OAuth tokens
- `claude-config` - Settings

### Re-login

```bash
docker exec -it claude-agent claude login
```

### Delete credentials

```bash
docker volume rm claude-credentials claude-config
```

## New Container with Existing Credentials

Credentials are shared via volumes. Any container mounting `claude-credentials` gets the same login:

```bash
docker run -d --name claude-agent-2 -v claude-credentials:/home/node/.claude -v claude-config:/home/node/.config -v $(pwd)/.mcp.json:/home/node/.mcp.json:ro claude-agent
```

## Files

| File | Purpose |
|------|---------|
| `Dockerfile.claude-agent` | Docker image definition |
| `.mcp.json` | MCP server configuration (mounted into container) |
| `claude-run.sh` | Wrapper script for running prompts |

## Flags Reference

| Flag | Purpose |
|------|---------|
| `--dangerously-skip-permissions` | Skip all permission prompts |
| `--print` | Print response and exit (non-interactive) |
| `-p "prompt"` | The prompt to run |
| `--output-format json` | JSON output for parsing |
| `--max-turns N` | Limit agentic turns |

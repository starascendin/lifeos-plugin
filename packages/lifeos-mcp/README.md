# LifeOS MCP Server

MCP (Model Context Protocol) server for LifeOS Project Management. This allows AI assistants like Claude to interact with your LifeOS projects, issues, cycles, and notes.

## Available Tools

### Project Management
- **get_projects** - List all projects with stats
- **get_tasks** - Get tasks with filters (project, status, priority)
- **get_todays_tasks** - Get today's tasks and top priorities
- **create_issue** - Create a new task/issue
- **mark_issue_complete** - Mark a task as done

### Cycles/Sprints
- **get_current_cycle** - Get active cycle with progress
- **assign_issue_to_cycle** - Add task to a cycle

### Agenda
- **get_daily_agenda** - Today's tasks, events, priorities
- **get_weekly_agenda** - Week's tasks and events

### Notes
- **search_notes** - Search voice memos
- **get_recent_notes** - Get recent notes
- **create_quick_note** - Create a text note
- **add_tags_to_note** - Tag a note

## Setup

### 1. Get your User ID

You need your Convex user ID. You can find it by:
1. Opening your LifeOS app
2. Going to Settings > Developer
3. Copying your User ID

Or query it from Convex Dashboard.

### 2. Configure Claude Code

Add to your `.mcp.json` (in project root or `~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "lifeos": {
      "command": "npx",
      "args": ["tsx", "packages/lifeos-mcp/src/index.ts"],
      "env": {
        "CONVEX_URL": "https://your-deployment.convex.cloud",
        "LIFEOS_USER_ID": "your-user-id-here"
      }
    }
  }
}
```

### 3. Install dependencies

```bash
cd packages/lifeos-mcp
pnpm install
```

### 4. Test

```bash
# Run directly for testing
LIFEOS_USER_ID=your-user-id pnpm dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONVEX_URL` | Yes | Your Convex deployment URL |
| `LIFEOS_USER_ID` | Yes | Your Convex user ID |
| `LIFEOS_API_KEY` | No | Custom API key (has default) |

## Development

```bash
# Build
pnpm build

# Run in dev mode
pnpm dev
```

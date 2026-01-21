# LifeOS MCP Server

MCP (Model Context Protocol) server for LifeOS Project Management. This allows AI assistants like Claude to interact with your LifeOS projects, tasks, cycles, notes, and contacts.

## Installation

```bash
npm install -g @starascendin/lifeos-mcp
```

Or use directly with npx (no install needed):

```bash
npx @starascendin/lifeos-mcp --url <your-convex-url> --user-id <your-user-id> --api-key <your-api-key>
```

## Configuration

### Required Parameters

| Parameter | CLI Flag | Env Variable | Description |
|-----------|----------|--------------|-------------|
| Convex URL | `--url`, `-u` | `CONVEX_URL` | Your Convex deployment URL (e.g., `https://your-app.convex.site`) |
| User ID | `--user-id`, `-i` | `LIFEOS_USER_ID` | Your LifeOS user ID |
| API Key | `--api-key`, `-k` | `LIFEOS_API_KEY` | Your API key for authentication |

### Getting Your Credentials

1. **Convex URL**: Find in your Convex dashboard - use the `.convex.site` URL (not `.convex.cloud`)
2. **User ID**: In LifeOS app, go to Settings > Developer, or query from Convex Dashboard
3. **API Key**: Generate from your LifeOS settings or Convex dashboard

## Usage with Claude Code

Add to your `.mcp.json` (project root or `~/.claude/mcp.json`):

### Using CLI flags:

```json
{
  "mcpServers": {
    "lifeos": {
      "command": "npx",
      "args": [
        "@starascendin/lifeos-mcp",
        "--url", "https://your-app.convex.site",
        "--user-id", "your-user-id",
        "--api-key", "your-api-key"
      ]
    }
  }
}
```

### Using environment variables:

```json
{
  "mcpServers": {
    "lifeos": {
      "command": "npx",
      "args": ["@starascendin/lifeos-mcp"],
      "env": {
        "CONVEX_URL": "https://your-app.convex.site",
        "LIFEOS_USER_ID": "your-user-id",
        "LIFEOS_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Available Tools

### Project Management
- **get_projects** - List all projects with stats
- **get_tasks** - Get tasks with filters (project, status, priority)
- **get_todays_tasks** - Get today's tasks and top priorities
- **create_issue** - Create a new task/issue
- **mark_issue_complete** - Mark a task as done

### Phases
- **get_phases** - Get all phases for a project
- **get_phase** - Get phase details with issues
- **create_phase** - Create a new phase
- **update_phase** - Update phase details
- **delete_phase** - Delete a phase
- **assign_issue_to_phase** - Assign/unassign issue to phase

### Cycles/Sprints
- **get_current_cycle** - Get active cycle with progress
- **assign_issue_to_cycle** - Add task to a cycle

### Agenda
- **get_daily_agenda** - Today's tasks, events, priorities
- **get_weekly_agenda** - Week's tasks and events

### Notes
- **search_notes** - Search voice memos/notes
- **get_recent_notes** - Get recent notes
- **create_quick_note** - Create a text note
- **add_tags_to_note** - Tag a note

### People/Contacts
- **get_people** - List all contacts
- **get_person** - Get person details with AI profile
- **search_people** - Search contacts by name
- **create_person** - Create a new contact
- **update_person** - Update contact details
- **get_memos_for_person** - Get voice memos linked to a person
- **get_person_timeline** - Get interaction timeline
- **link_memo_to_person** - Link a memo to a person

### Clients
- **get_clients** - List all clients
- **get_client** - Get client details
- **get_projects_for_client** - Get client's projects
- **create_client** - Create a new client
- **update_client** - Update client details

## CLI Help

```bash
lifeos-mcp --help
```

## License

MIT

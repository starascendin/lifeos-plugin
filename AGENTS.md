# Setting Up Agents with LifeOS

How to give any AI agent access to your LifeOS data and workflows.

## Prerequisites

You need three credentials:

| Variable | Description | Where to find |
|----------|-------------|---------------|
| `LIFEOS_CONVEX_URL` | Your Convex deployment URL (`.convex.site`) | Convex dashboard |
| `LIFEOS_USER_ID` | Your LifeOS user ID | Convex dashboard > Users table |
| `LIFEOS_API_KEY` | API key for authentication | Generated in LifeOS settings |

## Quick Start by Agent Type

### Claude Code

One command — installs skills + MCP server:

```bash
claude plugin add github:starascendin/lifeos-plugin
```

Then set the env vars so the MCP server can authenticate:

```bash
export LIFEOS_CONVEX_URL=https://your-app.convex.site
export LIFEOS_USER_ID=your-user-id
export LIFEOS_API_KEY=your-api-key
```

The agent now has:
- 36 skills (invoked via `/daily-standup`, `/capture "idea"`, `/health-check`, `/finance-overview`, `/life-pillars`, `/north-star`, `/life-compass`, etc.)
- 112 MCP tools (get_tasks, create_issue, get_health_sleep, get_finance_net_worth, get_pillars, get_north_stars, get_life_direction_summary, etc.)
- 27 MCP prompts (same workflows as skills, but via MCP protocol)

### OpenCode

OpenCode reads `.claude/skills/` natively.

**Step 1 — Install skills:**

```bash
# Option A: Clone and copy
git clone git@github.com:starascendin/lifeos-plugin.git /tmp/lifeos-plugin
cp -r /tmp/lifeos-plugin/skills/ .claude/skills/

# Option B: Symlink (good for shared volumes)
git clone git@github.com:starascendin/lifeos-plugin.git /opt/lifeos-plugin
ln -s /opt/lifeos-plugin/skills .claude/skills/lifeos
```

**Step 2 — Configure MCP server:**

Copy `.mcp.json.example` to `.mcp.json` in your project root and fill in credentials:

```bash
cp /opt/lifeos-plugin/.mcp.json.example .mcp.json
# Edit .mcp.json with your credentials
```

Or add to your existing `.mcp.json`:

```json
{
  "mcpServers": {
    "lifeos": {
      "command": "npx",
      "args": [
        "@starascendin/lifeos-mcp@latest",
        "--url", "https://your-app.convex.site",
        "--user-id", "your-user-id",
        "--api-key", "your-api-key"
      ]
    }
  }
}
```

### k3s / Docker / Self-Hosted Agents

For agents running on shared infrastructure (k3s, Docker Compose, etc.):

**Step 1 — Clone repo to shared volume:**

```bash
git clone git@github.com:starascendin/lifeos-plugin.git /shared/lifeos-plugin
```

**Step 2 — Set env vars in your deployment:**

```yaml
# k8s ConfigMap / docker-compose env
env:
  - name: LIFEOS_CONVEX_URL
    value: "https://your-app.convex.site"
  - name: LIFEOS_USER_ID
    valueFrom:
      secretKeyRef:
        name: lifeos-secrets
        key: user-id
  - name: LIFEOS_API_KEY
    valueFrom:
      secretKeyRef:
        name: lifeos-secrets
        key: api-key
```

**Step 3 — Mount in agent config:**

For Claude Code agents:
```bash
claude plugin add /shared/lifeos-plugin
```

For other agents, symlink the skills dir and copy `.mcp.json.example`:
```bash
ln -s /shared/lifeos-plugin/skills .claude/skills/lifeos
cp /shared/lifeos-plugin/.mcp.json.example .mcp.json
```

### Any MCP-Compatible Client

If the agent supports MCP but not skills/plugins, just configure the MCP server.

Add to the agent's MCP config (see `.mcp.json.example`):

```json
{
  "mcpServers": {
    "lifeos": {
      "command": "npx",
      "args": [
        "@starascendin/lifeos-mcp@latest",
        "--url", "https://your-app.convex.site",
        "--user-id", "your-user-id",
        "--api-key", "your-api-key"
      ]
    }
  }
}
```

This gives the agent 107 tools + 25 prompts. The prompts contain the same workflow logic as the skills — so even without skills installed, the agent can run `/daily-standup` via the MCP prompt.

Alternatively, use env vars instead of CLI args:

```json
{
  "mcpServers": {
    "lifeos": {
      "command": "npx",
      "args": ["@starascendin/lifeos-mcp@latest"],
      "env": {
        "CONVEX_URL": "https://your-app.convex.site",
        "LIFEOS_USER_ID": "your-user-id",
        "LIFEOS_API_KEY": "your-api-key"
      }
    }
  }
}
```

## What the Agent Gets

### 36 Skills (Claude Code / OpenCode)

| Skill | Usage | What it does |
|-------|-------|-------------|
| `daily-standup` | `/daily-standup` | Morning briefing: agenda, tasks, sprint |
| `end-of-day` | `/end-of-day` | EOD wrap-up with reflection prompts |
| `capture` | `/capture "buy milk"` | Auto-routes to task or note |
| `weekly-review` | `/weekly-review` | Week's completed work, blockers |
| `monthly-review` | `/monthly-review` | Monthly accomplishments and planning |
| `cycle-review` | `/cycle-review` | Sprint review with rollover |
| `initiative-review` | `/initiative-review 2026` | Yearly goals by category |
| `project-status` | `/project-status ACME` | Phase breakdown, task stats |
| `client-brief` | `/client-brief "Acme Corp"` | Client projects, comms, health |
| `client-health` | `/client-health` | Dashboard across all clients |
| `sprint-plan` | `/sprint-plan` | Review backlog, assign to cycle |
| `contact-lookup` | `/contact-lookup "John"` | Full dossier with AI insights |
| `meeting-prep` | `/meeting-prep "John"` | Context + talking points |
| `follow-ups` | `/follow-ups` | Who needs a reply |
| `relationship-pulse` | `/relationship-pulse` | Neglected relationships |
| `context-switch` | `/context-switch "Acme"` | Fast context loading |
| `inbox-triage` | `/inbox-triage` | Process notes into tasks |
| `overdue` | `/overdue` | Overdue and slipping items |
| `voice-notes` | `/voice-notes` | Interactive memo exploration |
| `voice-notes-crystallize` | `/voice-notes-crystallize` | Save conversation insights |
| `health-check` | `/health-check` | Quick Oura health overview: scores, trends |
| `health-weekly` | `/health-weekly` | Weekly health review with workouts |
| `screentime-report` | `/screentime-report` | Screen time analysis and top apps |
| `finance-overview` | `/finance-overview` | Net worth, accounts, trends |
| `finance-spending` | `/finance-spending` | Spending analysis and patterns |
| `habit-check` | `/habit-check` | Daily habit check-in, streaks, completions |
| `daily-training-report` | `/daily-training-report` | Daily training report with health + habits |
| `coaching-overview` | `/coaching-overview` | Coaching profiles, sessions, action items |
| `coaching-action-items` | `/coaching-action-items` | Manage coaching action items |
| `coaching-session-review` | `/coaching-session-review` | Review coaching session insights |
| `north-star` | `/north-star` | View and manage North Star visions |
| `life-compass` | `/life-compass` | Full life direction snapshot in one view |
| `life-pillars` | `/life-pillars` | Life pillars dashboard with pulse ratings |
| `pillar-pulse` | `/pillar-pulse` | Record pulse ratings for life pillars |
| `curiosity-capture` | `/curiosity-capture "learn piano"` | Quick capture a curiosity, idea, or dream |
| `curiosity-review` | `/curiosity-review` | Review curiosity queue and surface ideas |
| `coach-memory` | `/coach-memory` | View AI coach's accumulated knowledge |

### 112 MCP Tools

Full CRUD for: projects, tasks/issues, cycles, phases, clients, people/contacts, notes, voice memos, AI conversation summaries, Beeper threads, Granola meetings, initiatives, health (Oura Ring: sleep, activity, readiness, stress, SpO2, heart rate, workouts), finance (accounts, net worth, transactions, snapshots, daily spending), habits, screen time, coaching, and life direction (pillars, pulse, curiosities, North Stars, working memory).

### 27 MCP Prompts

Same workflows as the skills above, exposed via MCP protocol. Any MCP client can invoke them.

## Updating

```bash
# Update the plugin repo
cd /path/to/lifeos-plugin && git pull

# Update the MCP server (auto-updates with npx @latest)
# Or pin a version in .mcp.json: "@starascendin/lifeos-mcp@0.7.0"
```

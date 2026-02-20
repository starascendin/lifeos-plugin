# LifeOS Plugin

Universal skills and MCP integration for LifeOS — your personal productivity OS powered by Convex.

36 workflow skills for project management, contacts, agendas, voice notes, health (Oura Ring), finance, coaching, life direction, and more.

## Installation

### Claude Code

```bash
claude plugin add github:starascendin/lifeos-plugin
```

### OpenCode

OpenCode reads `.claude/skills/` natively. Copy or symlink the skills directory:

```bash
cp -r skills/ .claude/skills/lifeos/
```

Or symlink:

```bash
ln -s /path/to/lifeos-plugin/skills .claude/skills/lifeos
```

### Manual Setup

1. Copy the `skills/` directory to your agent's skills location
2. Configure the MCP server with your credentials:

```json
{
  "mcpServers": {
    "lifeos": {
      "command": "npx",
      "args": [
        "@starascendin/lifeos-mcp@latest",
        "--url", "YOUR_CONVEX_URL",
        "--user-id", "YOUR_USER_ID",
        "--api-key", "YOUR_API_KEY"
      ]
    }
  }
}
```

Or use environment variables:

```bash
export LIFEOS_CONVEX_URL=https://your-app.convex.site
export LIFEOS_USER_ID=your-user-id
export LIFEOS_API_KEY=your-api-key
```

## Skills (36 total)

### Daily Workflows
- **daily-standup** — Morning briefing with agenda, tasks, and sprint progress
- **end-of-day** — EOD wrap-up with completion summary and tomorrow planning
- **capture** — Quick capture a thought, task, or note with auto-routing

### Reviews
- **weekly-review** — Completed work, in-progress items, sprint health
- **monthly-review** — Accomplishments, project progress, next month planning
- **cycle-review** — Sprint review with rollover options
- **initiative-review** — Yearly initiative progress by category

### Project & Client Management
- **project-status** — Phase breakdown, task stats, blockers
- **client-brief** — Full client briefing with projects and comms
- **client-health** — Health dashboard across all clients
- **sprint-plan** — Plan sprints by reviewing backlog and capacity

### People & Relationships
- **contact-lookup** — Full contact dossier with AI insights
- **meeting-prep** — Prepare for meetings with full context
- **follow-ups** — Track follow-ups needed with people and clients
- **relationship-pulse** — Check on neglected relationships
- **context-switch** — Fast context loading for a client or project

### Task Management
- **inbox-triage** — Process notes into actionable tasks
- **overdue** — Surface overdue and slipping items

### Voice Notes
- **voice-notes** — Interactive voice memo exploration
- **voice-notes-crystallize** — Save conversation insights as crystallized summaries

### Health (Oura Ring)
- **health-check** — Quick health overview: sleep, activity, readiness scores and trends
- **health-weekly** — Weekly health review with workouts, recovery, and recommendations

### Screen Time
- **screentime-report** — Usage patterns, top time-sink apps, social media alerts, category breakdown

### Finance
- **finance-overview** — Net worth summary, account balances, and trend analysis
- **finance-spending** — Spending analysis with daily patterns and recent transactions

### Habits & Accountability
- **habit-check** — Daily habit check-in: review today's habits, mark completions, celebrate streaks, flag missed reps
- **daily-training-report** — Comprehensive daily training report: yesterday's results, today's focus, habit compliance, health data, ADHD focus management

### Coaching
- **coaching-overview** — Dashboard of coaching profiles, recent sessions, and pending action items
- **coaching-action-items** — Review and manage coaching action items across all coaches
- **coaching-session-review** — Review a coaching session's summary, key insights, and action items

### Life Direction
- **north-star** — View and manage North Star visions: the big compelling life directions everything else organizes beneath
- **life-compass** — Full life direction snapshot: North Stars, pillars, curiosities, coaching action items, and coach memory in one view
- **life-pillars** — Dashboard of your core life areas with pulse ratings, vision narratives, and gaps
- **pillar-pulse** — Guided pulse check-in: rate each pillar 1-5 with before/after comparison
- **curiosity-capture** — Quick capture an idea, dream, hobby, or what-if into your curiosity queue
- **curiosity-review** — Review curiosity queue, surface stale items, promote to projects
- **coach-memory** — View the AI coach's accumulated knowledge about you across 10 sections

#### Recommended Pillar Workflow

The pillar skills work best as a regular self-reflection practice:

1. **Set up pillars once** — `/life-pillars` shows your current pillars. If empty, ask the agent to help you define 4-6 core life areas (e.g. Body, Social, Work, Growth, Money, Joy). Each pillar should have a `desiredFeeling` and `visionNarrative` describing what life feels like when that area is thriving.

2. **Weekly pulse check-in** — Run `/pillar-pulse` once a week (Sunday evening or Monday morning works well). Rate each pillar 1-5:
   - 1 = Dead/neglected
   - 2 = Struggling
   - 3 = Coasting/maintenance
   - 4 = Growing
   - 5 = Thriving

   Add a short note explaining the rating. Over time this builds a trend of how each area of your life is evolving.

3. **Capture curiosities as they come** — When you have a random idea, dream, or "what if", run `/curiosity-capture "learn to surf"`. Don't overthink it — the queue is intentionally low-friction. Curiosities can later be linked to pillars or promoted to real projects.

4. **Monthly curiosity review** — Run `/curiosity-review` monthly to surface forgotten ideas, park things that no longer resonate, and promote anything that's calling to you into an initiative or project.

5. **Coach memory evolves passively** — The coach memory sections get populated as you have AI coaching conversations. Run `/coach-memory` to see what the AI has learned about your patterns, values, triggers, and breakthroughs.

## MCP Server

The plugin uses `@starascendin/lifeos-mcp` — an npm package that exposes LifeOS tools and prompts via Model Context Protocol.

Install standalone:

```bash
npm install -g @starascendin/lifeos-mcp
lifeos-mcp --url https://your-app.convex.site --user-id xxx --api-key yyy
```

## License

MIT

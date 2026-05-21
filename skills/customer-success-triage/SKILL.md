---
name: customer-success-triage
description: Triage client requests and customer-success work using the client workspace, business chats, Fathom and Granola meetings, notes, and open tasks. Use when reviewing customer asks, checking whether work is already tracked, capturing requirement summaries, or deciding what should become a task.
---

Triage customer-success work. `$ARGUMENTS` should contain the client name or ID, plus an optional focus area.

Use the LifeOS MCP tools in this order:

1. Call `get_client_success_workspace` with the client from `$ARGUMENTS`.
2. Review the workspace output first:
   - `recentThreads`
   - `recentMeetings`
   - `notes`
   - `openTasks`
   - `projects`
3. Drill down only when needed:
   - chat detail: `get_beeper_thread_messages`
   - Fathom detail: `get_fathom_meeting`, `get_fathom_transcript`
   - Granola detail: `get_granola_meeting`, `get_granola_transcript`
   - existing note history: `get_client_notes`
4. For relevant workspace projects, call `get_belief_reframes` with `projectIds` to surface linked fears, inversions, and limiting-belief friction records before deciding what is blocked or risky.
5. For PPV/project graph relationship work, prefer `get_project_graph` for the relevant project because it includes PPV context and `belief_reframe` friction nodes. Use FalkorDB only for sidecar traversal or agent-owned relationship links.
   - Use Falkor to see whether projects and PPV context are already linked in the FalkorDB sidecar.
   - Use `falkor_graph_link` only for durable agent-owned relationships with `reason` and `confidence`.
   - Do not edit canonical client/project/chat/meeting/note records through FalkorDB.

Classify findings into:

- **New Requirements**: net-new asks or requested changes
- **Follow-Ups**: things waiting on you or the team
- **Risks / Blockers**: scope ambiguity, overdue work, delivery risk, churn risk
- **Fears / Inversions**: linked friction records that explain avoidance, delivery risk, or operating constraints
- **Already Tracked**: notes or tasks that already cover the request

Use writes deliberately:

- Save durable account memory with `create_client_note` or `update_client_note`
- Use `create_issue` or `update_issue` only for execution work
- Prefer updating existing notes/tasks over creating duplicates
- Do not delete anything

Present the result as:

- **Situation Summary**: what the client currently needs
- **Evidence**: supporting messages, meetings, and notes
- **Existing Tracking**: what is already captured
- **Graph Links**: existing or newly created FalkorDB sidecar links that connect the request to projects or PPV
- **Tracking Plan**: what should be a note vs. a task
- **Next Actions**: owner, action, deadline

If the user did not explicitly ask you to make changes, ask for confirmation before any write operation.

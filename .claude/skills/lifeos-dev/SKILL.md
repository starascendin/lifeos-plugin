---
name: lifeos-dev
description: Work with LifeOS DEV environment (beaming-giraffe-300). Use for tasks, projects, clients, contacts, notes, and agenda in development.
user-invocable: true
---

# LifeOS Dev Environment

You are now working with the **LifeOS DEV** environment.

## Environment Details
| Property | Value |
|----------|-------|
| Convex Deployment | beaming-giraffe-300 |
| URL | https://beaming-giraffe-300.convex.site |
| Clerk | Development environment |
| Purpose | Local development and testing |

## MCP Server
Use tools from the `lifeos-dev` MCP server for all LifeOS operations.

## Available Tools

**Projects & Tasks**
- `get_projects` - List all projects with stats
- `get_tasks` - Get tasks with filters
- `get_todays_tasks` - Daily task list
- `create_issue` - Create new task
- `mark_issue_complete` - Complete a task

**Cycles/Sprints**
- `get_current_cycle` - Current sprint info
- `assign_issue_to_cycle` - Add task to sprint

**Agenda**
- `get_daily_agenda` - Today's agenda
- `get_weekly_agenda` - Week overview

**Notes**
- `search_notes` - Search notes
- `get_recent_notes` - Recent notes
- `create_quick_note` - Create note
- `add_tags_to_note` - Tag a note

**FRM (Contacts)**
- `get_people` - List contacts
- `get_person` - Contact details + AI profile
- `search_people` - Search contacts
- `get_memos_for_person` - Memos for contact
- `get_person_timeline` - Interaction history
- `create_person` - Add contact
- `update_person` - Update contact
- `link_memo_to_person` - Link memo to contact

**Clients**
- `get_clients` - List clients
- `get_client` - Client details
- `get_projects_for_client` - Client's projects
- `create_client` - Add client
- `update_client` - Update client

## Safety
This is test/development data. Safe to create, modify, and delete freely.

---
name: lifeos-staging
description: Work with LifeOS STAGING environment (adorable-firefly-704). Use for pre-production testing of tasks, projects, clients, contacts.
user-invocable: true
---

# LifeOS Staging Environment

You are now working with the **LifeOS STAGING** environment.

## Environment Details
| Property | Value |
|----------|-------|
| Convex Deployment | adorable-firefly-704 |
| URL | https://adorable-firefly-704.convex.site |
| Clerk | Development environment (shared with dev) |
| Purpose | Pre-production testing and QA |

## MCP Server
Use tools from the `lifeos-staging` MCP server for all LifeOS operations.

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

## Caution
This is staging data used for QA testing. Use caution with destructive operations.
Confirm before bulk deletions or major data changes.

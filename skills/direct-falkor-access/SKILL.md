---
name: direct-falkor-access
description: Use when the user explicitly wants direct FalkorDB access outside the MCP safety layer for graph creation, deletion, or unrestricted Cypher against the Falkor browser/API.
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [lifeos, falkor, graph, direct-api, admin]
    related_skills: [falkor-graph, ppv]
---

# Direct Falkor Access

Use this skill only when the user explicitly wants **direct FalkorDB access outside the MCP safety layer**.

This is for cases like:
- creating a brand new graph such as `grand_vision`
- deleting or replacing a graph
- running mutation Cypher that MCP intentionally blocks
- reverse-engineering or troubleshooting the Falkor browser/API itself

Do **not** use this skill for normal PPV graph reads or simple agent-owned links. For that, use the regular `falkor-graph` skill and the MCP tools.

## Required context

Expect these environment values to exist somewhere local before attempting direct access:
- `FALKOR_BROWSER_ENDPOINT`
- `FALKOR_HOST`
- `FALKOR_PORT`
- `FALKOR_USER`
- `FALKOR_PASS`
- optionally `FALKOR_TLS`

In this workspace they may live in a repo env file such as `.env.local`, but do not assume the exact path in other environments.

Never print raw credentials, session cookies, or bearer tokens back to the user. If you must report config, redact values as `[REDACTED]`.

## When to use MCP instead

Prefer MCP when the task is any of the following:
- inspect schema/labels/allowed relationships
- run read-only Cypher in the existing sidecar graph
- create `AGENT_LINK` relationships only
- answer questions about PPV, pillars, identities, or project relationships

Use direct access only when the user explicitly asks to go outside MCP or the task requires graph-level admin operations that MCP cannot do.

## Proven direct API flow

The Falkor browser uses an authenticated web session. A workable scripted flow is:

1. Read local Falkor config values from env.
2. `GET /api/auth/csrf`
3. `POST /api/auth/callback/credentials`
   - form fields: `csrfToken`, `callbackUrl`, `json`, `host`, `port`, `username`, `password`, `tls`
4. `GET /api/auth/session`
   - extract `activeConnectionId`
5. Use the authenticated cookie jar plus optional `X-Connection-Id` header for graph operations.

## Direct graph endpoints

### Query a graph

`GET /api/graph/{graphName}?query=<urlencoded cypher>`

Notes:
- responses come back as **SSE text/event-stream**, not plain JSON
- parse lines beginning with `event:` and `data:`
- success typically uses `event: result`
- failures often use `event: error`

### Create a graph

`POST /api/graph/{graphName}`

Observed successful response shape:

```json
{"message":"Graph created successfully"}
```

### Delete a graph

`DELETE /api/graph/{graphName}`

Observed successful response shape:

```json
{"message":"<graph> graph deleted"}
```

## Important behavioral quirks

1. **Querying a missing graph name may create an empty graph implicitly.**
   - Do not verify deletion by immediately querying the just-deleted graph.
   - Instead, inspect a different source of truth or simply stop after successful delete.

2. **Graph names with spaces can exist.**
   - Example: `grand vision`
   - But for repeatable automation, prefer normalized names like `grand_vision`.

3. **The direct route is outside MCP guardrails.**
   - You can mutate data freely.
   - Double-check scope before destructive actions.

4. **Existing sessions may cache tool/skill state.**
   - After installing or changing a skill, use a fresh Hermes session or restart the gateway/CLI before claiming it is available.

## Recommended workflow

1. Confirm the user explicitly wants direct access outside MCP.
2. Discover current graph state first.
   - identify graph names in play
   - inspect counts before mutation
3. Normalize the target graph name unless the user insists otherwise.
4. Authenticate through the browser API session flow.
5. If creating/replacing a graph:
   - optionally delete the old graph first
   - create the target graph
   - populate in idempotent chunks using `MERGE`
6. Verify with read queries against the intended target graph.
7. Do not re-query a deleted graph name unless you intentionally want it recreated.
8. Report exactly what changed and which graph should be treated as canonical.

## Python helper pattern

Use `execute_code` or a local Python script when the flow needs auth + multiple dependent requests.

```python
from pathlib import Path
import re, json, urllib.request, urllib.parse, urllib.error, http.cookiejar

env = Path('/path/to/.env.local').read_text()

def get(key: str) -> str:
    m = re.search(rf'^{re.escape(key)}=(.*)$', env, re.M)
    return m.group(1).strip() if m else ''

base = get('FALKOR_BROWSER_ENDPOINT')
auth_fields = {
    'host': get('FALKOR_HOST'),
    'port': get('FALKOR_PORT'),
    'username': get('FALKOR_USER'),
    'password': get('FALKOR_PASS'),
    'tls': get('FALKOR_TLS').lower(),
}

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def http(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with opener.open(req, timeout=30) as r:
            return r.status, r.read().decode('utf-8', 'ignore'), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'ignore'), dict(e.headers)

csrf = json.loads(http(base + '/api/auth/csrf')[1])['csrfToken']
http(
    base + '/api/auth/callback/credentials',
    data=urllib.parse.urlencode({
        'csrfToken': csrf,
        'callbackUrl': base + '/graph',
        'json': 'true',
        **auth_fields,
    }).encode(),
    headers={'Content-Type': 'application/x-www-form-urlencoded'},
)
session = json.loads(http(base + '/api/auth/session')[1])
conn_id = session['activeConnectionId']

# create graph
http(base + '/api/graph/grand_vision', headers={'X-Connection-Id': conn_id}, method='POST')

# query graph
query = urllib.parse.quote('MATCH (n) RETURN count(n) AS c')
status, body, _ = http(
    base + '/api/graph/grand_vision?query=' + query,
    headers={'X-Connection-Id': conn_id},
)
print(status)
print(body)
```

## Cypher guidance for direct writes

- Prefer `MERGE` over `CREATE` for idempotent reruns.
- Populate in small chunks rather than one giant mutation.
- Verify counts after each major section when the graph matters.
- When storing source references from LifeOS, keep explicit fields like `sourceId`, `projectKey`, `status`, and human-readable `title`.

## Verification checklist

After a direct mutation task, verify at least:
- target graph name is the intended canonical one
- root node count is correct
- supporting node counts match expectation
- edge counts or representative traversals succeed
- any old graph name was deleted if that was part of scope
- no accidental duplicate graph remains

## Reporting checklist

Tell the user:
- which graph you changed
- whether any old graph was deleted
- verified node counts
- any quirks that could affect what they see in the Falkor UI

Do not include:
- raw passwords
- CSRF tokens
- session cookies
- bearer tokens

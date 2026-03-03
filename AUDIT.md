# Audit & Activity Logging

## Overview

Every user-facing action should produce an audit record in `audits_entry`. There are two mechanisms depending on transport:

- **HTTP routes** — middleware-driven, opt-in per route via dependency
- **WebSocket handlers** — manual, each handler calls the logger directly

Both resolve `session_id` automatically. Neither requires the handler to pass it.

## Database Schema

```
audits_entry: id, message, endpoint, error (bool), session_id, created_at
profiles_audits_connection: profiles_id, audit_id, created_at, generated, mcp, active
```

## Key Files

| File | Purpose |
|------|---------|
| `server/app/v5/infra/activity/audit.py` | `audit_activity()` dependency + `audit_set()` helper |
| `server/app/v5/infra/activity/logger.py` | HTTP activity logger (called by middleware) |
| `server/app/v5/infra/activity/websocket_logger.py` | WebSocket activity logger |
| `server/app/v5/infra/activity/insert.py` | DB insert for HTTP audits |
| `server/app/v5/infra/activity/insert_websocket.py` | DB insert for WebSocket audits |

---

## Adding Audit to an HTTP Route

### Step 1: Import

```python
from app.v5.infra.activity.audit import audit_activity, audit_set
```

### Step 2: Add dependency to route decorator

```python
@router.post(
    "/save",
    response_model=SaveAgentApiResponse,
    dependencies=[
        audit_activity(
            "agent.saved",                                          # event_key (stable identifier)
            "{{ actor.name }} saved agent '{{ agent.name }}'",      # Jinja2 template
        )
    ],
)
```

**Event key convention:** `{entity}.{action}` for artifacts (e.g., `agent.saved`, `cohort.deleted`), `views.{domain}.{endpoint}` for views (e.g., `views.analytics.attempts.get`).

**Template convention:** Always start with `{{ actor.name }}`. Use past tense for the action. Reference entity names when available.

### Step 3: Set audit context inside the handler

```python
audit_set(
    http_request,
    actor={"name": actor_name, "id": profile_id},
    agent={"name": result.name or "Unknown", "id": str(result.id)},
)
```

`audit_set()` merges into `request.state.audit_ctx`. Only safe, serializable fields. The middleware renders the Jinja template with this context after the response.

### How it works (no action needed)

1. `audit_activity()` sets `request.state.audit_intent` (event_key + template)
2. Handler calls `audit_set()` to populate context
3. `DBLoggingMiddleware` in `main.py` fires in `finally` block — renders template, inserts to DB
4. `session_id` is read from `request.state.session_id` (set by `get_session_id` dependency from `X-Session-Id` header)
5. Fire-and-forget — never blocks the response

### Read-only endpoints (no audit_set needed)

For GET/list endpoints that don't have entity context, just add the dependency — the middleware will still log with the actor from the profile context:

```python
@router.post(
    "/bundle/get",
    response_model=GetBenchmarkBundleResponse,
    dependencies=[
        audit_activity("benchmark.bundle.get", "{{ actor.name }} viewed benchmark bundle")
    ],
)
```

### What NOT to audit

- `/docs` endpoints (schema/documentation, not user actions)
- `/draft` endpoints (auto-save, too noisy — exception: `simulation/draft` which is an explicit patch)
- Resource-layer GET/SEARCH endpoints (internal building blocks, not user-facing)

---

## Adding Audit to a WebSocket Handler

### Step 1: Import

```python
from app.v5.infra.activity.websocket_logger import log_websocket_activity
```

### Step 2: Call after the action succeeds

```python
try:
    await log_websocket_activity(
        sid=sid,
        event_key="attempt.stop.stopped",
        template="{{ actor.name }} stopped attempt",
        context={"chat_id": chat_id},
        endpoint="/socket/v5/attempt/stop",
        error=False,
    )
except Exception:
    pass  # Never break the handler for audit logging
```

### How it works (no action needed)

1. `log_websocket_activity()` resolves `profile_id` from socket ID via Redis (`find_profile_by_socket`)
2. Fetches `actor_name` from DB using profile_id
3. Merges `{"actor": {"name": ..., "id": ...}}` into context
4. Renders Jinja template
5. `session_id` is resolved from Redis key `socket_session:{sid}` (set during WebSocket connect)
6. Fire-and-forget insert to `audits_entry`

### Always wrap in try/except

WebSocket audit logging must never break the handler. Always wrap in `try/except Exception: pass`.

### Generation handlers — use the chokepoint

All domain generation handlers (agent, simulation, persona, etc.) emit to a single internal `generate_artifact` event in `server/app/v5/socket/artifacts/generate.py`. Audit logging is already added at this chokepoint — individual generation handlers do NOT need their own audit calls.

The chokepoint logs: `{{ actor.name }} started {{ artifact_type }} generation ({{ resource_type }})`.

### Handlers that need individual audit calls

These don't go through the `generate_artifact` chokepoint:

| Handler | Why |
|---------|-----|
| `benchmark/start.py` | Creates structure, doesn't generate |
| `test/run_all.py` | Orchestrator, chains to test_run |
| `test/control.py` | Stop signal |
| `attempt/control.py` | Stop/end/end_all |
| `attempt/audio.py` | Audio start/stop |
| `attempt/responses.py` | Quiz response submission |

### What NOT to audit (WebSocket)

- `complete.py`, `progress.py`, `error.py` — server-to-client relays, not user actions
- Room join/leave (`attempt/room.py`, `test/room.py`) — ephemeral state management

---

## Checklist for New Endpoints

When adding a new HTTP route:

- [ ] Is it a user-facing action (not docs/draft)? Add `audit_activity()` dependency
- [ ] Is it a mutation (save/delete/duplicate/create)? Also add `audit_set()` with entity context
- [ ] Follow event key convention: `{entity}.{action}`

When adding a new WebSocket handler:

- [ ] Does it go through `generate_artifact`? Already covered by chokepoint
- [ ] Is it a new user-initiated action? Add `log_websocket_activity()` wrapped in try/except
- [ ] Is it a server relay (complete/progress/error)? Skip audit

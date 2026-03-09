---
name: dhh-architecture
description: Architecture guide for this project, including the three-layer BFF pattern (views/resources/artifacts), entry functions for mutations, hand-crafted types, and socket generation. Use when modifying v5 API routes.
---

# Architecture Guide

## Three-Layer BFF Pattern

The API has three main layers, each with a distinct responsibility:

| Layer | Location | Purpose |
|-------|----------|---------|
| **Views** | `server/app/routes/v5/api/views/` | Read layer — queries MVs with declarative SQL filters, exposes `*_internal()` functions |
| **Resources** | `server/app/routes/v5/api/resources/` | Reusable data-access functions with per-resource caching, exposes `*_internal()` |
| **Artifacts** | `server/app/routes/v5/api/main/` | BFF aggregation — combines views + resources + permissions into client-ready bundles |

Supporting layers:

| Layer | Location | Purpose |
|-------|----------|---------|
| **Entry Functions** | `server/app/routes/v5/tools/entries/` | Black box functions for mutations (group→run→call→domain entry chains) |
| **Socket** | `server/app/routes/v5/socket/artifacts/` | WebSocket event handlers for AI generation (generate, complete, progress, error) |
| **Permissions** | `*/permissions.py` per artifact | Pure Python business logic — no SQL, uses data from artifact layer |
| **Infrastructure** | `server/app/infra/` | Activity audit, error handling, caching, websocket adapters |

## File Locations

```
server/app/routes/v5/tools/entries/[entry_type]/  — Black box entry functions (create/search)
server/app/routes/v5/api/main/[resource]/   — Artifact endpoints (persona, dashboard, etc.)
server/app/routes/v5/api/resources/[resource]/   — Resource endpoints (personas, colors, etc.)
server/app/routes/v5/api/views/[domain]/         — View endpoints (analytics, simulation, etc.)
server/app/routes/v5/socket/artifacts/[resource]/ — Socket handlers (generate, complete, etc.)
server/tests/integration/api/v5/[resource]/ — Integration tests
server/tests/e2e/                          — E2E Playwright tests
```

## Type Flow: Pydantic to TypeScript

```
Hand-crafted Pydantic types (routes/shared_types.py, per-route types.py)
    ↓ make openapi-gen
server/openapi.json
    ↓ make gen-client-types
client/lib/api/schema.ts → InputOf / OutputOf in pages
```

**After changing route signatures:** Run `make openapi-gen` and `make gen-client-types` to regenerate client types.

## Key Patterns

### 1. Two-Pass Data Fetching (Artifact Layer)

**Pass 1:** SQL query returns metadata (IDs, counts, flags, access info)
**Pass 2:** Python calls `*_internal()` resource functions in parallel via `asyncio.gather()`

```python
# Pass 2 — parallel resource fetching
colors, departments, names = await asyncio.gather(
    get_colors_internal(c, color_ids, bypass_cache),
    get_departments_internal(c, dept_ids, bypass_cache),
    get_names_internal(c, name_ids, bypass_cache),
)
```

### 2. Internal Function Pattern

Every resource and view exposes `*_internal()` functions for reuse:

```python
# Resource internal — called by artifacts and socket layers
async def get_personas_internal(conn, ids, bypass_cache=False) -> list[Item]:

# View internal — called by artifact aggregation layers
async def get_attempt_facts_internal(conn, profile_id, ...) -> Result:
```

### 3. Mutation Pattern (Entry Functions)

Mutations use black box entry functions with group→run→call chains:

```python
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run

session_id = http_request.state.session_id
group_result = await create_group(conn, session_id=session_id)
run_result = await create_run(conn, group_id=group_result.id, session_id=session_id)
call_result = await create_call(conn, run_id=run_result.id, session_id=session_id)
```

### 4. Permissions Layer (Pure Python)

Each artifact has a `permissions.py` with pure functions — no SQL:

```python
def compute_can_edit(user_role, persona_department_ids, active_scenario_count) -> bool:
def compute_can_delete(user_role, persona_department_ids, total_scenario_links) -> bool:
```

### 5. Declarative SQL Filters (Views Layer)

Views use NULL-coalescing WHERE clauses — no dynamic SQL string building:

```sql
WHERE (profile_id_filter IS NULL OR af.profile_id = profile_id_filter)
  AND (simulation_ids IS NULL OR cardinality(simulation_ids) = 0 OR af.simulation_id = ANY(simulation_ids))
  AND (date_from IS NULL OR af.attempt_created_at >= date_from)
```

### 6. Socket Generation (AI Operations)

Each artifact's socket layer has four files:
- `generate.py` — client-to-server request handler
- `complete.py` — emits typed completion events with full resource objects
- `progress.py` — emits granular progress events
- `error.py` — emits typed error events

### 7. Cache Architecture

- **Per-endpoint cache:** Full response with TTL + tags
- **Per-resource cache:** Individual resource objects cached independently
- **Invalidation:** `await invalidate_tags(tags)` after mutations
- **Bypass:** `X-Bypass-Cache: 1` header

## Key Principles

- Composite types in `types` schema — never JSONB
- Hand-crafted Pydantic types in `routes/shared_types.py` and per-route `types.py`
- Mutations use entry functions from `v5/tools/entries/`
- Transactions for mutations only, not for reads
- Profile ID from `http_request.state.profile_id`

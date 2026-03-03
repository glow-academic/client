---
name: dhh-architecture
description: DHH-style API architecture guide for this project, including the three-layer BFF pattern (views/resources/artifacts), SQL compilation, socket generation, and auto-generated types. Use when modifying v5 API routes or SQL files.
---

# Architecture Guide

## Three-Layer BFF Pattern

The API has three main layers, each with a distinct responsibility:

| Layer | Location | Purpose |
|-------|----------|---------|
| **Views** | `server/app/v5/api/views/` | Read layer — queries MVs with declarative SQL filters, exposes `*_internal()` functions |
| **Resources** | `server/app/v5/api/resources/` | Reusable data-access functions with per-resource caching, exposes `*_internal()` |
| **Artifacts** | `server/app/v5/api/main/` | BFF aggregation — combines views + resources + permissions into client-ready bundles |

Supporting layers:

| Layer | Location | Purpose |
|-------|----------|---------|
| **Socket** | `server/app/v5/socket/artifacts/` | WebSocket event handlers for AI generation (generate, complete, progress, error) |
| **Permissions** | `*/permissions.py` per artifact | Pure Python business logic — no SQL, uses data from artifact layer |
| **Infrastructure** | `server/app/v5/infra/` | SQL compilation, activity audit, error handling, caching |

## File Locations

```
server/app/v5/sql/queries/[resource]/     — SQL files (one per route)
server/app/v5/api/main/[resource]/   — Artifact endpoints (persona, dashboard, etc.)
server/app/v5/api/resources/[resource]/   — Resource endpoints (personas, colors, etc.)
server/app/v5/api/views/[domain]/         — View endpoints (analytics, simulation, etc.)
server/app/v5/socket/artifacts/[resource]/ — Socket handlers (generate, complete, etc.)
server/tests/integration/api/v5/[resource]/ — Integration tests
server/tests/e2e/                          — E2E Playwright tests
```

## Type Flow: SQL to TypeScript

```
SQL files (server/app/v5/sql/queries/)
    ↓ make sql-compile (executes functions in DB, introspects, generates types)
server/app/sql/types.py (*SqlParams, *SqlRow, *ApiRequest, *ApiResponse)
    ↓ make openapi-gen
server/openapi.json
    ↓ make gen-client-types
client/lib/api/schema.ts → InputOf / OutputOf in pages
```

**Critical:** After changing any SQL file, run `make sql-compile` to regenerate types, then `make openapi-gen` and `make gen-client-types` if the route signature changed.

## Key Patterns

### 1. Two-Pass Data Fetching (Artifact Layer)

**Pass 1:** SQL query returns metadata (IDs, counts, flags, access info)
**Pass 2:** Python calls `*_internal()` resource functions in parallel via `asyncio.gather()`

```python
# Pass 1 — single SQL call for IDs and metadata
result = await execute_sql_typed(conn, SQL_PATH, params=params)

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

### 3. Permissions Layer (Pure Python)

Each artifact has a `permissions.py` with pure functions — no SQL:

```python
def compute_can_edit(user_role, persona_department_ids, active_scenario_count) -> bool:
def compute_can_delete(user_role, persona_department_ids, total_scenario_links) -> bool:
```

### 4. Declarative SQL Filters (Views Layer)

Views use NULL-coalescing WHERE clauses — no dynamic SQL string building:

```sql
WHERE (profile_id_filter IS NULL OR af.profile_id = profile_id_filter)
  AND (simulation_ids IS NULL OR cardinality(simulation_ids) = 0 OR af.simulation_id = ANY(simulation_ids))
  AND (date_from IS NULL OR af.attempt_created_at >= date_from)
```

### 5. SQL Execution

All SQL goes through `execute_sql_typed()` which auto-detects functions vs raw SQL:

```python
from app.utils.sql_helper import execute_sql_typed
from app.sql.types import GetPersonaAccessSqlParams, GetPersonaAccessSqlRow

result = cast(GetPersonaAccessSqlRow,
    await execute_sql_typed(conn, SQL_PATH, params=params))
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
- No inline SQL in Python — all SQL in `.sql` files
- Use `execute_sql_typed()` for all SQL execution
- Transactions for mutations only, not for reads
- Profile ID from `http_request.state.profile_id`

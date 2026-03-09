# API v5 Standards

This document defines the standards and best practices for API v5 endpoints. These standards ensure consistency, maintainability, and adherence to the three-layer BFF architecture pattern.

## Overview

API v5 endpoints follow the three-layer BFF pattern:

- **Views**: Read layer querying materialized views with declarative SQL filters
- **Resources**: Cached data-access functions with `*_internal()` for reuse
- **Artifacts**: BFF aggregation — combines views + resources + permissions
- **Entry functions**: Mutations use black box entry functions in `v5/tools/entries/`
- **Hand-crafted Pydantic types**: In `routes/shared_types.py` and per-route `types.py` files
- **Composite types** in the `types` schema for strongly typed nested database structures

## Key Principles

### 1. Entry Functions for Mutations

**Mutations** use black box entry functions from `server/app/routes/v5/tools/entries/`:

```python
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run

# Standard mutation chain: group → run → call → domain entry
session_id = http_request.state.session_id
group_result = await create_group(conn, session_id=session_id)
run_result = await create_run(conn, group_id=group_result.id, session_id=session_id)
call_result = await create_call(conn, run_id=run_result.id, session_id=session_id)

# Then call domain-specific entry function
await create_problem_entry(conn, session_id=session_id, call_id=call_result.id, ...)
```

### 2. Hand-Crafted Pydantic Types

- **Shared types**: `server/app/routes/shared_types.py` for cross-route types
- **Per-route types**: `types.py` files alongside route handlers
- Types are manually maintained Pydantic BaseModel subclasses
- No auto-generation from SQL — edit types directly

### 3. No JSONB - Use Composite Types

**JSONB is NEVER allowed, even for complex nested structures.**

**Key Principles:**

- **No JSONB in inputs**: Function parameters must use native PostgreSQL types (`uuid`, `text`, `uuid[]`, etc.) or composite types, never JSONB
- **Composite types for complex inputs**: If you need complex nested structures, use composite types as function parameters
- **No JSONB in outputs**: Collections are arrays, not JSONB objects — Use `ARRAY_AGG(...)::types.composite_type[]` instead of `json_agg(jsonb_build_object(...))`
- **No JSONB parsing**: Composite types are automatically decoded by `asyncpg` and converted to Pydantic models

### 4. Type Preservation

When defining composite types, use native PostgreSQL types (`uuid`, `timestamptz`) instead of stringifying them to `text` unless there's a specific reason.

**Key Principles:**

1. **Use native PostgreSQL types for IDs and timestamps:**
   ```sql
   -- ✅ Good: native types
   CREATE TYPE types.q_list_agents_v4_agent AS (
       agent_id uuid,           -- Not text!
       model_id uuid,           -- Not text!
       updated_at timestamptz,  -- Not text!
       name text,
       description text
   );
   ```

2. **Only use `text` when truly needed:**
   - **Arrays of IDs for frontend compatibility**: `department_ids text[]`
   - **Display-only fields**: `actor_name text`
   - **Enum-like values**: `role text`

3. **Type system handles conversion automatically:**
   - `asyncpg` automatically converts PostgreSQL `uuid` → Python `UUID` objects
   - `asyncpg` automatically converts PostgreSQL `timestamptz` → Python `datetime` objects
   - Pydantic models validate and serialize these types correctly
   - Use `model_dump(mode='json')` for caching to serialize UUIDs/timestamps to JSON

### 5. Existence Checks in SQL

Detail endpoints should return `*_exists boolean` fields from SQL functions:

```python
# ✅ GOOD: SQL function returns existence check
if not result.agent_exists:
    raise HTTPException(status_code=404, detail=f"Agent {request.agent_id} not found")
```

### 6. Strong Enum Comparisons

**Always use strong enum comparisons for type safety.**

```sql
-- ✅ Good: Strong comparison using explicit cast (preferred)
WHERE a.role = 'grade'::agent_role
WHERE p.role = 'superadmin'::profile_type

-- ❌ Bad: Weak comparison (runtime error if invalid)
WHERE a.role = 'grade'
WHERE p.role = 'superadmin'
```

**IN clauses with enum columns:**
```sql
-- ✅ Good: Strong comparison with explicit casts
WHERE role IN ('admin'::profile_type, 'superadmin'::profile_type)

-- ❌ Bad: Weak comparison (no cast)
WHERE role IN ('admin', 'superadmin')
```

**Enum Types in Codebase:**
- `agent_role`, `profile_role`, `message_role`
- `pricing_type`, `feedback_type`, `message_feedback_type`, `modality_type`, `option_type`, `quality`, `reasoning_effort`, `tool_type`, `unit_category`, `voice`

## File Organization

```
server/app/routes/v5/api/main/[resource]/   — Artifact endpoints (persona, dashboard, etc.)
server/app/routes/v5/api/resources/[resource]/   — Resource endpoints (personas, colors, etc.)
server/app/routes/v5/api/views/[domain]/         — View endpoints (analytics, simulation, etc.)
server/app/routes/v5/tools/entries/[entry_type]/  — Black box entry functions
server/app/routes/v5/socket/artifacts/[resource]/ — Socket handlers (generate, complete, etc.)
server/tests/integration/api/v5/[resource]/ — Integration tests
server/tests/e2e/                          — E2E Playwright tests
```

## Composite Types

- **Schema**: All query-specific composite types live in `types` schema
- **Naming**: `types.q_{operation}_{resource}_v4_{item_name}` (e.g., `types.q_list_agents_v4_agent`)
- **Versioned**: Include version (e.g. `v5`) in type names for future compatibility
- **Shared**: Types can be reused across API, WebSocket, and infrastructure endpoints

## Type Flow

```
Hand-crafted Pydantic types (routes/shared_types.py, per-route types.py)
    ↓ make openapi-gen
server/openapi.json
    ↓ make gen-client-types
client/lib/api/schema.ts → InputOf / OutputOf in pages
```

## Junction Tables and Many-to-Many Relationships

### Eval Agents Pattern

**Pattern**: Use junction tables for many-to-many relationships between evals and agents.

```sql
-- Junction table for eval-to-agent relationships
CREATE TABLE eval_agents (
    eval_id uuid NOT NULL REFERENCES evals(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (eval_id, agent_id)
);
```

### Group Stop and Order Tables

**Pattern**: Standardized junction tables for group-level tool and agent ordering.

- `group_stop`: Defines tools that should be called to stop a group operation
- `group_order`: Defines the order of agents for a group operation

**Key Principles**:
- Use `position_idx` for ordering (integer, not timestamp)
- Use `UNIQUE (group_id, position_idx)` to ensure no duplicate positions
- Always `ORDER BY position_idx` when aggregating

## Common Patterns

### Two-Pass Data Fetching (Artifact Layer)

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

### Mutation Pattern (Entry Functions)

```python
# Standard mutation using entry function chain
session_id = http_request.state.session_id
group_result = await create_group(conn, session_id=session_id)
run_result = await create_run(conn, group_id=group_result.id, session_id=session_id)
call_result = await create_call(conn, run_id=run_result.id, session_id=session_id)

# Domain-specific entry
await create_test_archive(conn, test_id=test_id, call_id=call_result.id, archived=True)
```

### WebSocket Mutation Pattern

For mutations in WebSocket handlers, use `find_session_by_socket(sid)` to get session_id:

```python
from app.infra.websocket.db_helper import get_db_connection
from app.routes.v5.socket.utils import find_session_by_socket

session_id_str = await find_session_by_socket(sid) if sid else None
async with get_db_connection() as conn:
    result = await create_upload(conn, session_id=uuid.UUID(session_id_str), ...)
```

## Draft Endpoint Pattern

Draft endpoints enable optimistic concurrency control for form autosave. All draft endpoints follow the same pattern with resource-specific defaults.

**Endpoint**: `PATCH /api/v5/{resource}/draft`

**Key Points:**

1. **Text parameter**: SQL function accepts `patch text` (not `jsonb`) to allow asyncpg to pass JSON strings directly
2. **JSON encoding**: Python route encodes `dict` to JSON string before passing to SQL
3. **Optimistic concurrency**: Uses `expected_version` to prevent lost updates
4. **Create-on-miss**: Creates new draft if `input_draft_id` is None or version mismatch occurs
5. **Resource-specific defaults**: Default values in SQL are resource-specific

### Cache Invalidation Pattern

**Standard Tags**:
- `["{resource}", "drafts"]` - Always invalidate
- `["profile"]` - Also invalidate when creating new draft

## MCP Documentation Pattern

Artifact documentation lives alongside API routes.

### Documentation File Location

Each artifact should have a `docs.py` file alongside its API route files:

```
server/app/routes/v5/api/main/persona/
├── get.py
├── save.py
├── list.py
├── duplicate.py
├── delete.py
├── draft.py
└── docs.py           # <-- Documentation here
```

### MCP Endpoints

The MCP server exposes documentation via:

- `docs_artifact(name: str) -> dict` - Get artifact-specific documentation
- `docs() -> dict` - Get general GLOW documentation
- `artifacts() -> list[dict]` - List artifacts with descriptions
- `resources() -> list[dict]` - List resources with descriptions

### Key Principles

1. **Documentation lives with routes**: `docs.py` is alongside `get.py`, `save.py`, etc.
2. **MCP imports docs**: MCP server imports from API routes, doesn't duplicate
3. **Consistent pattern**: Each artifact follows same pattern for docs
4. **Root docs separate**: General GLOW info in MCP folder, artifact-specific in API routes

## Testing Checklist

### Types & Data

- [ ] Hand-crafted Pydantic types match expected data shapes
- [ ] No JSONB parsing in route file — no `json.loads()` calls
- [ ] Type preservation: composite types use `uuid`/`timestamptz` for IDs/timestamps
- [ ] Strong enum comparisons — all enum comparisons use `'value'::enum_type` syntax

### API Testing

- [ ] Test all endpoints via `/api` command
- [ ] Verify collections are arrays, not dicts/JSONB objects
- [ ] Integration tests pass

### Caching & Serialization

- [ ] All `set_cached()` calls use `model_dump(mode='json')` for UUID serialization
- [ ] All `cache_key()` calls use `request.model_dump(mode='json')` for UUID serialization

## Benefits

1. **Simplicity**: No SQL compilation pipeline — types are hand-crafted and immediately available
2. **Reusability**: Black box entry functions provide consistent mutation patterns
3. **Strong Typing**: Pydantic enforces types at Python level, PostgreSQL at database level
4. **Maintainability**: Entry functions encapsulate database operations, reducing boilerplate
5. **Performance**: Composite types are efficient — direct type decoding without JSONB parsing
6. **Developer Experience**: No build step for types — edit and go
7. **Documentation**: Artifact docs live with routes, MCP server exposes them

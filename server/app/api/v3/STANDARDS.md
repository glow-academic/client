# API v3 Standards

This document defines the standards and best practices for API v3 endpoints. These standards ensure consistency, maintainability, and adherence to the agents-style architecture pattern using PostgreSQL functions with composite types.

## Overview

API v3 endpoints follow the agents-style architecture pattern, which uses:

- **PostgreSQL functions** with `RETURNS TABLE` instead of raw SQL queries
- **Composite types** in the `types` schema for strongly typed nested structures
- **Auto-generated Pydantic models** from SQL introspection instead of manual type definitions
- **Single SQL file per route** with idempotent drop/recreate pattern
- **Automatic type conversion** via `execute_sql_typed()` helper
- **Strong typing** for both inputs and outputs

## Key Principles

### 1. One SQL File Per Route

**⚠️ CRITICAL: One SQL File Per Route, No Inline SQL**

- **One SQL file per API route**: Each route has exactly one SQL file in `server/app/sql/v3/[resource]/[operation]_complete.sql`
- **No inline SQL**: All SQL must be in the `.sql` file, never embedded as strings in Python code
- **Function-based**: SQL files define PostgreSQL functions, not raw queries
- **File naming**: Pattern `[operation]_[resource]_complete.sql` (e.g., `get_agent_detail_complete.sql`, `create_agent_complete.sql`)

**Why This Matters:**

- ✅ Type generation requires SQL files to introspect function signatures
- ✅ SQL files can be version controlled and reviewed independently
- ✅ No SQL string concatenation or dynamic SQL in Python code
- ✅ Clear separation: SQL logic in `.sql` files, Python logic in route files

### 2. PostgreSQL Functions with Composite Types

- **One function per route**: Function name follows `api_{operation}_{resource}_v3` pattern
- **RETURNS TABLE**: Functions return structured rows with explicit column types
- **Composite types**: Nested structures use composite types in `types` schema
- **Idempotent**: Files use `BEGIN; DROP FUNCTION; DROP TYPE; CREATE TYPE; CREATE FUNCTION; COMMIT;`

### 3. No JSONB - Use Composite Types

**⚠️ CRITICAL: JSONB is NEVER allowed, even for complex nested structures.**

**Key Principles:**

- **No JSONB in inputs**: Function parameters must use native PostgreSQL types (`uuid`, `text`, `uuid[]`, etc.) or composite types, never JSONB
- **Composite types for complex inputs**: If you need complex nested structures in request bodies, use composite types as function parameters
- **No JSONB in outputs**: Collections are arrays, not JSONB objects - Use `ARRAY_AGG(...)::types.composite_type[]` instead of `json_agg(jsonb_build_object(...))`
- **No JSONB parsing**: Composite types are automatically decoded by `asyncpg` and converted to Pydantic models
- **Lists everywhere**: All collections return as arrays of composite types, not nested JSONB structures

### 4. Type Preservation

**⚠️ CRITICAL: Preserve Native PostgreSQL Types**

When defining composite types, use native PostgreSQL types (`uuid`, `timestamptz`) instead of stringifying them to `text` unless there's a specific reason.

**Key Principles:**

1. **Use native PostgreSQL types for IDs and timestamps:**
   ```sql
   -- ✅ Good: native types
   CREATE TYPE types.q_list_agents_v3_agent AS (
       agent_id uuid,           -- Not text!
       model_id uuid,           -- Not text!
       updated_at timestamptz,  -- Not text!
       name text,
       description text
   );
   ```

2. **Only use `text` when truly needed:**
   - **Arrays of IDs for frontend compatibility**: `department_ids text[]` (when frontend expects string arrays)
   - **Display-only fields**: `actor_name text` (always a string, never a UUID)
   - **Enum-like values**: `role text` (when representing enum values as strings)

3. **Type system handles conversion automatically:**
   - `asyncpg` automatically converts PostgreSQL `uuid` → Python `UUID` objects
   - `asyncpg` automatically converts PostgreSQL `timestamptz` → Python `datetime` objects
   - Pydantic models validate and serialize these types correctly
   - Use `model_dump(mode='json')` for caching to serialize UUIDs/timestamps to JSON

### 5. Auto-Generated Types Only

**⚠️ CRITICAL: Never Keep Manual Types for camelCase Compatibility**

**Key Principles:**

1. **Always use auto-generated types**: Use `{RouteName}ApiRequest` types generated from SQL function signatures, never create manual request types
2. **Convert frontend to snake_case**: If frontend uses camelCase, convert it to snake_case before sending to API - don't accept camelCase in backend
3. **SQL functions use snake_case**: PostgreSQL function parameters use snake_case (e.g., `cohort_ids`, `department_ids`, `profile_id`)
4. **Auto-generated types match SQL**: Generated `{RouteName}ApiRequest` types use snake_case to match SQL function signatures

### 6. Double Star Pattern for Parameters

Always use `**request.model_dump()` when constructing SQL params:

```python
# ✅ GOOD: Double star pattern
params = CreateCohortSqlParams(**request.model_dump(), profile_id=profile_id)

# ❌ BAD: Manual dict construction
request_dict = request.model_dump()
request_dict['description'] = request_dict.get('description') or ''
params = CreateCohortSqlParams(**request_dict, profile_id=profile_id)
```

### 7. Existence Checks in SQL

Detail endpoints should return `*_exists boolean` fields from SQL functions, not use inline SQL:

```python
# ✅ GOOD: SQL function returns existence check
# SQL: RETURNS TABLE (agent_exists boolean, ...)
if not result.agent_exists:
    raise HTTPException(status_code=404, detail=f"Agent {request.agent_id} not found")

# ❌ BAD: Inline SQL existence check
agent_exists_check = await conn.fetchval(
    "SELECT EXISTS(SELECT 1 FROM agents WHERE id = $1)",
    request.agent_id,
)
```

### 8. Handle None-to-Empty Conversions in SQL

SQL functions handle defaults consistently via COALESCE in params CTE:

```sql
-- ✅ Good: SQL handles None-to-empty conversions via COALESCE in params CTE
WITH params AS (
    SELECT
        name AS name,
        COALESCE(NULLIF(description, ''), '') AS description,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        profile_id AS profile_id
),
-- ... rest of query uses params.x.department_ids (never NULL)
```

### 9. Strong Enum Comparisons

**⚠️ CRITICAL: Always use strong enum comparisons for type safety.**

PostgreSQL enums provide strong type safety, but only when comparisons are done correctly. Weak comparisons (enum column = 'string') defer errors to runtime, while strong comparisons provide compile-time-like validation.

**Key Principles:**

1. **Preferred: Explicit cast syntax**
   ```sql
   -- ✅ Good: Strong comparison using explicit cast (preferred)
   WHERE a.role = 'grade'::agent_role
   WHERE p.role = 'superadmin'::profile_role
   WHERE m.role = 'user'::message_role
   ```

2. **Alternative: Shorthand syntax**
   ```sql
   -- ✅ Good: Strong comparison using shorthand (alternative)
   WHERE a.role = agent_role 'grade'
   WHERE p.role = profile_role 'superadmin'
   WHERE m.role = message_role 'user'
   ```

3. **Never compare enums to raw strings**
   ```sql
   -- ❌ Bad: Weak comparison (runtime error if invalid)
   WHERE a.role = 'grade'
   WHERE p.role = 'superadmin'
   WHERE m.role = 'user'
   ```

4. **IN clauses with enum columns**
   ```sql
   -- ✅ Good: Strong comparison with explicit casts
   WHERE role IN ('admin'::profile_role, 'superadmin'::profile_role)
   WHERE agent_role IN ('hint'::agent_role, 'grade'::agent_role, 'simulation'::agent_role)
   
   -- ❌ Bad: Weak comparison (no cast)
   WHERE role IN ('admin', 'superadmin')
   WHERE agent_role IN ('hint', 'grade', 'simulation')
   
   -- ❌ Bad: Invalid syntax (PostgreSQL doesn't support enum_type.value)
   WHERE role IN (profile_role.admin, profile_role.superadmin)
   ```

5. **ANY clauses with text arrays**
   ```sql
   -- ✅ Good: Cast text array to enum array
   WHERE role = ANY($5::profile_role[])
   -- Or cast individual elements
   WHERE role = ANY(SELECT unnest($5::text[])::profile_role)
   
   -- ❌ Bad: Comparing enum column to text array
   WHERE role = ANY($5::text[])
   ```

6. **CASE statements**
   ```sql
   -- ✅ Good: Strong comparison with explicit cast
   CASE WHEN role = 'superadmin'::profile_role THEN ...
   
   -- ❌ Bad: Weak comparison (no cast)
   CASE WHEN role = 'superadmin' THEN ...
   
   -- ❌ Bad: Invalid syntax (PostgreSQL doesn't support enum_type.value)
   CASE WHEN role = profile_role.superadmin THEN ...
   ```

7. **Function parameters typed as text[]**
   When function accepts `text[]` but compares to enum column, cast before comparison:
   ```sql
   -- ✅ Good: Cast text parameter to enum before comparison
   WHERE role = ANY(SELECT unnest($5::text[])::profile_role)
   WHERE role_value::profile_role IN ('admin'::profile_role, 'superadmin'::profile_role)
   ```

8. **Old enum value references**
   After enum migrations (e.g., migration 152), update old values:
   - `'simulation-text'` → `'simulation'` (use `'simulation'::agent_role`)
   - `'simulation-voice'` → `'voice'` (use `'voice'::agent_role`)
   - `'grade-text'` → `'grade'` (use `'grade'::agent_role`)
   - `'grade-voice'` → `'audio'` (use `'audio'::agent_role`)
   - `'outline'` → `'scenario'` (use `'scenario'::agent_role`)

**Enum Types in Codebase:**
- `agent_role` (used in `agents.role`, `tools.agent_role`, `rubrics.agent_role`)
- `profile_role` (used in `profiles.role`)
- `message_role` (used in `messages.role`)
- `pricing_type`, `feedback_type`, `message_feedback_type`, `modality_type`, `option_type`, `quality`, `reasoning_effort`, `tool_type`, `unit_category`, `voice`

**Validation:**
The `make sql-format` command includes `check_enum_comparisons.py` which validates all SQL files for weak enum comparisons and old enum value references.

## SQL File Organization

**Example Structure:**

```
server/app/api/v3/agents/
├── list.py          # Route handler
├── detail.py        # Route handler
└── create.py        # Route handler

server/app/sql/v3/agents/
├── get_agents_list_complete.sql    # One SQL file per route
├── get_agent_detail_complete.sql  # One SQL file per route
└── create_agent_complete.sql      # One SQL file per route
```

## Composite Types

- **Schema**: All query-specific composite types live in `types` schema
- **Naming**: `types.q_{operation}_{resource}_v3_{item_name}` (e.g., `types.q_list_agents_v3_agent`)
- **Versioned**: Include `v3` in type names for future compatibility
- **Shared**: Types can be reused across API, WebSocket, and infrastructure endpoints

## Type Generation

- **Auto-detection**: `execute_sql_typed()` detects if SQL file contains a function
- **Introspection**: Queries `pg_proc` and `pg_type` to extract function signatures
- **Pydantic models**: Generates `{RouteName}SqlParams`, `{RouteName}SqlRow`, `{RouteName}ApiRequest`, `{RouteName}ApiResponse`
- **Composite models**: Generates nested Pydantic models for composite types

## Junction Tables and Many-to-Many Relationships

### Eval Agents Pattern

**Pattern**: Use junction tables for many-to-many relationships between evals and agents.

**Example**: `eval_agents` table links evals to multiple agents:

```sql
-- Junction table for eval-to-agent relationships
CREATE TABLE eval_agents (
    eval_id uuid NOT NULL REFERENCES evals(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (eval_id, agent_id)
);

CREATE INDEX eval_agents_eval_id_idx ON eval_agents(eval_id);
CREATE INDEX eval_agents_agent_id_idx ON eval_agents(agent_id);
```

**SQL Query Pattern**: Join with junction table to get agent arrays:

```sql
-- ✅ Good: Get agent_ids array from junction table
SELECT 
    e.id as eval_id,
    e.name,
    ARRAY_AGG(ea.agent_id ORDER BY ea.created_at) FILTER (WHERE ea.agent_id IS NOT NULL) as agent_ids
FROM evals e
LEFT JOIN eval_agents ea ON ea.eval_id = e.id
WHERE e.id = $1::uuid
GROUP BY e.id
```

**Migration Pattern**: Migrate from single column to junction table:

```sql
-- Migrate existing data
INSERT INTO eval_agents (eval_id, agent_id)
SELECT id, agent_id FROM evals WHERE agent_id IS NOT NULL;

-- Then drop the old column
ALTER TABLE evals DROP COLUMN agent_id;
```

### Group Stop and Order Tables

**Pattern**: Standardized junction tables for group-level tool and agent ordering.

**Purpose**: 
- `group_stop`: Defines tools that should be called to stop a group operation
- `group_order`: Defines the order of agents for a group operation

**Example**:

```sql
-- Tools to call for stopping group operations
CREATE TABLE group_stop (
    group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    tool_id uuid NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    position_idx integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, tool_id, position_idx),
    UNIQUE (group_id, position_idx) -- Ensure unique ordering
);

-- Agent ordering for group operations
CREATE TABLE group_order (
    group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    position_idx integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, agent_id, position_idx),
    UNIQUE (group_id, position_idx) -- Ensure unique ordering
);
```

**SQL Query Pattern**: Join with ordering tables when needed:

```sql
-- ✅ Good: Get ordered tools for stopping
SELECT 
    g.id as group_id,
    ARRAY_AGG(gs.tool_id ORDER BY gs.position_idx) as stop_tool_ids
FROM groups g
LEFT JOIN group_stop gs ON gs.group_id = g.id
WHERE g.id = $1::uuid
GROUP BY g.id

-- ✅ Good: Get ordered agents
SELECT 
    g.id as group_id,
    ARRAY_AGG(go.agent_id ORDER BY go.position_idx) as agent_ids
FROM groups g
LEFT JOIN group_order go ON go.group_id = g.id
WHERE g.id = $1::uuid
GROUP BY g.id
```

**Key Principles**:
- Use `position_idx` for ordering (integer, not timestamp)
- Use `UNIQUE (group_id, position_idx)` to ensure no duplicate positions
- Always `ORDER BY position_idx` when aggregating
- These tables are standardized across all group types (chat_groups, scenario_groups, etc.)

## Common Patterns

### Simple Function (No Composite Types)

```sql
CREATE OR REPLACE FUNCTION api_delete_agent_v3(
    agent_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    usage_count bigint,
    deleted boolean,
    name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
-- SQL body
$$;
```

### Function with Composite Type Array

```sql
CREATE TYPE types.q_list_agents_v3_agent AS (
    agent_id uuid,                -- ✅ Native uuid type
    name text,
    description text,
    model_id uuid,                -- ✅ Native uuid type
    updated_at timestamptz,       -- ✅ Native timestamptz type
    department_ids text[],         -- ✅ text[] for arrays (frontend compatibility)
);

CREATE OR REPLACE FUNCTION api_list_agents_v3(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    agents types.q_list_agents_v3_agent[]
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (a.id, a.name, a.description, a.model_id, a.updated_at, 
             ARRAY_AGG(ad.department_id::text ORDER BY ad.created_at))::types.q_list_agents_v3_agent
            ORDER BY a.name
        ),
        '{}'::types.q_list_agents_v3_agent[]
    ) as agents
FROM agents a
-- ...
$$;
```

## Common Pitfalls

### Pitfall 1: Using JSONB Instead of Composite Types

**⚠️ CRITICAL: JSONB is NEVER allowed, even for complex nested structures.**

```sql
-- ❌ Bad: JSONB aggregation (NEVER ALLOWED)
json_agg(
    jsonb_build_object(
        'agent_id', a.id,
        'name', a.name
    )
) as agents

-- ✅ Good: Composite type array
ARRAY_AGG(
    (a.id, a.name)::types.q_list_agents_v3_agent
    ORDER BY a.name
) as agents
```

### Pitfall 2: Manual Type Definitions

```python
# ❌ BAD: Manual type with camelCase
class SearchStaffRequest(BaseModel):
    cohortIds: list[str] | None = None  # camelCase

# ✅ GOOD: Use auto-generated type
from app.sql.types import GetStaffSearchApiRequest
# Frontend converts camelCase to snake_case before sending
```

### Pitfall 3: Inline SQL

```python
# ❌ BAD: Inline SQL
agent_exists_check = await conn.fetchval(
    "SELECT EXISTS(SELECT 1 FROM agents WHERE id = $1)",
    request.agent_id,
)

# ✅ GOOD: SQL function returns existence check
# SQL: RETURNS TABLE (agent_exists boolean, ...)
if not result.agent_exists:
    raise HTTPException(status_code=404, detail="Agent not found")
```

### Pitfall 4: UUID Serialization Errors in Caching

**Error:** `TypeError: Object of type UUID is not JSON serializable`

**Solution:** Always use `model_dump(mode='json')` for caching:

```python
# ✅ GOOD: UUIDs serialized to strings
body_dict = request.model_dump(mode='json')  # UUIDs → strings for cache key
cache_key_val = cache_key(http_request.url.path, body_dict)
await set_cached(
    cache_key_val,
    {"data": api_response.model_dump(mode='json')},  # UUIDs → strings
    ttl=60,
    tags=tags,
)
```

## Testing Checklist

### SQL & Types

- [ ] **One SQL file per route** (e.g., `get_agent_detail_complete.sql` for `detail.py`)
- [ ] **No inline SQL** (all SQL in `.sql` files, none in Python code - including existence checks)
- [ ] **No multiple SQL files per route** (single file contains all SQL logic)
- [ ] **Double star pattern**: Use `**request.model_dump()` for parameter construction
- [ ] **No manual None-to-empty conversions**: SQL handles defaults via COALESCE in params CTE
- [ ] **Existence checks in SQL**: Detail endpoints return `*_exists boolean` fields from SQL functions
- [ ] SQL file compiles (`make sql-compile`)
- [ ] Types generated correctly (`server/app/sql/types.py`)
- [ ] **No JSONB parsing in route file** - No `json.loads()` calls
- [ ] **No JSONB in inputs** - Function parameters use native PostgreSQL types or composite types, never JSONB
- [ ] **All JSONB aggregations converted** - No `jsonb_build_object`, `json_agg`, or `jsonb_agg` in SQL files
- [ ] **Type preservation**: Composite types use `uuid`/`timestamptz` for IDs/timestamps (not `text` unless truly needed)
- [ ] **No manual request types** - All endpoints use auto-generated `{RouteName}ApiRequest` types from SQL introspection
- [ ] **Strong enum comparisons** - All enum comparisons use `'value'::enum_type` or `enum_type 'value'` syntax (checked by `make sql-format`)
- [ ] **No old enum values** - All references to old enum values updated after migrations (checked by `make sql-format`)

### API Testing

- [ ] Test all endpoints via `/api` command
- [ ] Verify collections are arrays, not dicts/JSONB objects
- [ ] Verify no JSONB parsing errors in server logs
- [ ] Integration tests pass

### Caching & Serialization

- [ ] All `set_cached()` calls use `model_dump(mode='json')` for UUID serialization
- [ ] All `cache_key()` calls use `request.model_dump(mode='json')` for UUID serialization
- [ ] No UUID serialization errors in server logs

## Reference Implementation

See `server/app/api/v3/agents/list.py` and `server/app/sql/v3/agents/get_agents_list_complete.sql` as the reference implementation.

## Benefits

1. **Strong Typing**: PostgreSQL enforces types at database level, Pydantic enforces at API level
2. **Type Safety**: All types generated from SQL, no drift between SQL and Python
3. **Maintainability**: Single SQL file, clear function signature, idempotent migrations
4. **Performance**: No JSONB aggregation overhead - composite types are more efficient, direct type decoding without parsing
5. **No JSONB Parsing Errors**: Types are enforced at database level - no runtime `json.loads()` failures or type mismatches
6. **Developer Experience**: Auto-completion, type checking, fewer runtime errors
7. **Consistency**: Same pattern for API, WebSocket, and infrastructure endpoints


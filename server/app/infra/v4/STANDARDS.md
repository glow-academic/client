# Infrastructure v4 Standards

This document defines the standards and best practices for Infrastructure v4 utilities. These standards ensure consistency, maintainability, and adherence to the agents-style architecture pattern using PostgreSQL functions with composite types.

## Overview

Infrastructure v4 utilities follow the agents-style architecture pattern, which uses:

- **PostgreSQL functions** with `RETURNS TABLE` instead of raw SQL queries (for database operations)
- **Composite types** in the `types` schema for strongly typed nested structures
- **Auto-generated Pydantic models** from SQL introspection instead of manual type definitions
- **Single SQL file per function** with idempotent drop/recreate pattern
- **Automatic type conversion** via `execute_sql_typed()` helper
- **Strong typing** for both inputs and outputs

Infrastructure utilities are categorized into three types:

1. **Database Operations**: Utilities that interact with PostgreSQL (should use PostgreSQL functions)
2. **Redis Operations**: Utilities that interact with Redis (follow consistent patterns)
3. **Pure Python Utilities**: Utilities that don't interact with database/Redis (standard Python patterns)

## Key Principles

### 1. Database Operations: One SQL File Per Function

**⚠️ CRITICAL: One SQL File Per Function, No Inline SQL**

- **One SQL file per infra function**: Each database operation has exactly one SQL file in `server/app/sql/v4/infrastructure/[category]/[operation]_complete.sql`
- **No inline SQL**: All SQL must be in the `.sql` file, never embedded as strings in Python code
- **Function-based**: SQL files define PostgreSQL functions, not raw queries
- **File naming**: Pattern `infrastructure_{category}_{operation}_complete.sql` (e.g., `infrastructure_activity_profile_exists_complete.sql`)

**Why This Matters:**

- ✅ Type generation requires SQL files to introspect function signatures
- ✅ SQL files can be version controlled and reviewed independently
- ✅ No SQL string concatenation or dynamic SQL in Python code
- ✅ Clear separation: SQL logic in `.sql` files, Python logic in infra files

### 2. PostgreSQL Functions with Composite Types

- **One function per infra operation**: Function name follows `infra_{operation}_{category}_v4` pattern
- **RETURNS TABLE**: Functions return structured rows with explicit column types
- **Composite types**: Nested structures use composite types in `types` schema
- **Idempotent**: Files use `BEGIN; DROP FUNCTION; DROP TYPE; CREATE TYPE; CREATE FUNCTION; COMMIT;`

### 3. No JSONB - Use Composite Types

**⚠️ CRITICAL: JSONB is NEVER allowed, even for complex nested structures.**

**Key Principles:**

- **No JSONB in inputs**: Function parameters must use native PostgreSQL types (`uuid`, `text`, `uuid[]`, etc.) or composite types, never JSONB
- **Composite types for complex inputs**: If you need complex nested structures, use composite types as function parameters
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
   CREATE TYPE types.q_infra_profile_exists_v4_result AS (
       profile_exists boolean
   );
   ```

2. **Only use `text` when truly needed:**
   - **Display-only fields**: `actor_name text` (always a string, never a UUID)
   - **Enum-like values**: `role text` (when representing enum values as strings)

3. **Type system handles conversion automatically:**
   - `asyncpg` automatically converts PostgreSQL `uuid` → Python `UUID` objects
   - `asyncpg` automatically converts PostgreSQL `timestamptz` → Python `datetime` objects
   - Pydantic models validate and serialize these types correctly

### 5. Auto-Generated Types Only

**⚠️ CRITICAL: Never Keep Manual Types**

**Key Principles:**

1. **Always use auto-generated types**: Use `{FunctionName}SqlParams` and `{FunctionName}SqlRow` types generated from SQL function signatures
2. **SQL functions use snake_case**: PostgreSQL function parameters use snake_case (e.g., `profile_id`, `department_id`)
3. **Auto-generated types match SQL**: Generated types use snake_case to match SQL function signatures

### 6. Redis Operations Pattern

**⚠️ CRITICAL: Consistent Redis Patterns**

Infrastructure utilities that interact with Redis should follow these patterns:

1. **Consistent error handling**: Always fallback to in-memory storage when Redis unavailable
2. **Key naming**: Use consistent prefixes (`socket_owner:`, `active_connection:`, `active_run:`)
3. **No logging**: Redis operations should not log errors (let callers handle logging)
4. **Type hints**: All functions should have complete type hints

**Example Pattern:**

```python
"""Get the active run ID for a chat from Redis."""

from app.main import get_redis_client

async def get_active_run(chat_id: str) -> str | None:
    """Get the active run ID for a chat from Redis."""
    redis_client = get_redis_client()
    if not redis_client:
        return None

    try:
        run_id = await redis_client.get(f"active_run:{chat_id}")
        return run_id.decode("utf-8") if run_id else None
    except Exception:
        # Don't log - let caller handle errors
        return None
```

### 7. Pure Python Utilities Pattern

**⚠️ CRITICAL: Standard Python Patterns**

Infrastructure utilities that don't interact with database/Redis should follow standard Python patterns:

1. **Type hints**: All functions should have complete type hints
2. **Documentation**: All public functions should have docstrings
3. **No side effects**: Pure utilities should be deterministic and have no side effects

**Example Pattern:**

```python
"""Database connection helper for WebSocket handlers."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import asyncpg

from app.main import get_pool

@asynccontextmanager
async def get_db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Get database connection for WebSocket handlers.

    Raises:
        RuntimeError: If database connection pool is not initialized
    """
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database connection pool not initialized")

    async with pool.acquire() as connection:
        yield connection
```

## SQL File Organization

**Example Structure:**

```
server/app/infra/v4/activity/
├── profile_exists.py          # Python function
└── insert.py                  # Python function

server/app/sql/v4/infrastructure/activity/
└── get_profile_name_for_logging_complete.sql    # One SQL file per function

server/app/sql/v4/infrastructure/
├── infrastructure_activity_profile_exists_complete.sql    # One SQL file per function
└── infrastructure_activity_insert_complete.sql            # One SQL file per function
```

## Composite Types

- **Schema**: All query-specific composite types live in `types` schema
- **Naming**: `types.q_infra_{operation}_{category}_v4_{item_name}` (e.g., `types.q_infra_profile_exists_v4_result`)
- **Versioned**: Include `v4` in type names for future compatibility
- **Shared**: Types can be reused across API, WebSocket, and infrastructure endpoints

## Type Generation

- **Auto-detection**: `execute_sql_typed()` detects if SQL file contains a function
- **Introspection**: Queries `pg_proc` and `pg_type` to extract function signatures
- **Pydantic models**: Generates `{FunctionName}SqlParams`, `{FunctionName}SqlRow`
- **Composite models**: Generates nested Pydantic models for composite types

**Key Difference from API/WebSocket:**

- **No ApiRequest/ApiResponse**: Infra functions use `SqlParams`/`SqlRow` directly (no `ApiRequest`/`ApiResponse` wrapper types)
- **Helper functions**: Infra functions are called by routes/events, not exposed directly

## Common Patterns

### Simple Function (No Composite Types)

```sql
BEGIN;

-- Drop function if exists (handle signature changes)
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS infra_profile_exists_v4(uuid);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION infra_profile_exists_v4(
    profile_id uuid
)
RETURNS TABLE (
    profile_exists boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = profile_id) as profile_exists;
$$;

COMMIT;
```

### Python Function Using execute_sql_typed

```python
"""Check if a profile exists in the database."""

import asyncpg  # type: ignore
from typing import cast

from app.sql.types import (
    InfrastructureActivityProfileExistsSqlParams,
    InfrastructureActivityProfileExistsSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/infrastructure/infrastructure_activity_profile_exists_complete.sql"


async def profile_exists(profile_id: str, conn: asyncpg.Connection) -> bool:
    """Check if a profile exists in the database.

    Args:
        profile_id: Profile UUID string
        conn: Database connection

    Returns:
        True if profile exists, False otherwise
    """
    try:
        params = InfrastructureActivityProfileExistsSqlParams(profile_id=profile_id)
        result = cast(
            InfrastructureActivityProfileExistsSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        return result.profile_exists if result else False
    except (asyncpg.DataError, ValueError):
        # Invalid UUID format - profile cannot exist
        return False
```

## Common Pitfalls

### Pitfall 1: Using Raw SQL Instead of Functions

```python
# ❌ BAD: Raw SQL with load_sql()
sql = load_sql("app/sql/v4/infrastructure/infrastructure_activity_profile_exists_complete.sql")
result = await conn.fetchval(sql, profile_id)

# ✅ GOOD: PostgreSQL function with execute_sql_typed()
params = InfrastructureActivityProfileExistsSqlParams(profile_id=profile_id)
result = cast(
    InfrastructureActivityProfileExistsSqlRow,
    await execute_sql_typed(conn, SQL_PATH, params=params),
)
```

### Pitfall 2: Manual Type Definitions

```python
# ❌ BAD: Manual type definition
class ProfileExistsParams(BaseModel):
    profile_id: str

# ✅ GOOD: Use auto-generated type
from app.sql.types import InfraProfileExistsSqlParams
```

### Pitfall 3: Inline SQL

```python
# ❌ BAD: Inline SQL
result = await conn.fetchval(
    "SELECT EXISTS(SELECT 1 FROM profiles WHERE id = $1)",
    profile_id,
)

# ✅ GOOD: SQL function in .sql file
params = InfraProfileExistsSqlParams(profile_id=profile_id)
result = await execute_sql_typed(conn, SQL_PATH, params=params)
```

### Pitfall 4: JSONB Instead of Composite Types

```sql
-- ❌ BAD: JSONB aggregation (NEVER ALLOWED)
json_agg(
    jsonb_build_object(
        'profile_id', p.id,
        'name', p.name
    )
) as profiles

-- ✅ GOOD: Composite type array
ARRAY_AGG(
    (p.id, p.name)::types.q_infra_list_profiles_v4_profile
    ORDER BY p.name
) as profiles
```

## Testing Checklist

### SQL & Types

- [ ] **One SQL file per function** (e.g., `profile_exists_complete.sql`)
- [ ] **No inline SQL** (all SQL in `.sql` files, none in Python code)
- [ ] **PostgreSQL function** (uses `CREATE OR REPLACE FUNCTION` with `RETURNS TABLE`)
- [ ] **Function naming** (follows `infra_{operation}_{category}_v4` pattern)
- [ ] **Idempotent SQL** (uses `BEGIN; DROP FUNCTION; CREATE FUNCTION; COMMIT;`)
- [ ] SQL file compiles (`make sql-compile`)
- [ ] Types generated correctly (`server/app/sql/types.py`)
- [ ] **No JSONB parsing in Python file** - No `json.loads()` calls
- [ ] **No JSONB in inputs** - Function parameters use native PostgreSQL types or composite types, never JSONB
- [ ] **All JSONB aggregations converted** - No `jsonb_build_object`, `json_agg`, or `jsonb_agg` in SQL files
- [ ] **Type preservation**: Composite types use `uuid`/`timestamptz` for IDs/timestamps (not `text` unless truly needed)
- [ ] **No manual types** - All functions use auto-generated `{FunctionName}SqlParams` and `{FunctionName}SqlRow` types from SQL introspection

### Python Function Testing

- [ ] Test function works correctly
- [ ] Verify types are generated correctly
- [ ] Verify callers still work with migrated function
- [ ] Integration tests pass

### Redis Operations Testing

- [ ] Fallback to in-memory storage when Redis unavailable
- [ ] Consistent key naming patterns
- [ ] No logging in Redis operations
- [ ] Type hints complete

### Pure Python Utilities Testing

- [ ] Type hints complete
- [ ] Documentation complete
- [ ] No side effects (if applicable)

## Reference Implementation

See `server/app/infra/v4/activity/profile_exists.py` and `server/app/sql/v4/infrastructure/infrastructure_activity_profile_exists_complete.sql` as the reference implementation for database operations.

## Benefits

1. **Strong Typing**: PostgreSQL enforces types at database level, Pydantic enforces at Python level
2. **Type Safety**: All types generated from SQL, no drift between SQL and Python
3. **Maintainability**: Single SQL file, clear function signature, idempotent migrations
4. **Performance**: No JSONB aggregation overhead - composite types are more efficient, direct type decoding without parsing
5. **No JSONB Parsing Errors**: Types are enforced at database level - no runtime `json.loads()` failures or type mismatches
6. **Developer Experience**: Auto-completion, type checking, fewer runtime errors
7. **Consistency**: Same pattern for API, WebSocket, and infrastructure endpoints

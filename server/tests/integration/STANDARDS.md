# Integration Test Standards

This document defines the standards and best practices for integration tests. These standards ensure consistency, maintainability, and adherence to the agents-style architecture pattern using PostgreSQL functions with composite types and strong typing.

## Overview

Integration tests follow the agents-style architecture pattern, which uses:

- **PostgreSQL functions** with `RETURNS TABLE` instead of raw SQL queries
- **Composite types** in the `types` schema for strongly typed nested structures
- **Auto-generated Pydantic models** from SQL introspection instead of manual type definitions
- **Single SQL file per test operation** with idempotent drop/recreate pattern
- **Automatic type conversion** via `execute_sql_typed()` helper
- **Strong typing** for both inputs and outputs
- **No inline SQL** - All SQL must be in `.sql` files

## Key Principles

### 1. All SQL in Files - No Inline SQL

**⚠️ CRITICAL: All SQL Must Be in Files, Never Inline**

- **One SQL file per test operation**: Each test setup/teardown operation has exactly one SQL file in `server/tests/sql/v4/integration/{category}/{operation}_complete.sql`
- **No inline SQL**: All SQL must be in the `.sql` file, never embedded as strings in Python code
- **Function-based**: SQL files define PostgreSQL functions, not raw queries
- **File naming**: Pattern `test_{operation}_{resource}_v4_complete.sql` (e.g., `test_create_agent_v4_complete.sql`, `test_get_superadmin_alias_v4_complete.sql`)

**Why This Matters:**

- ✅ Type generation requires SQL files to introspect function signatures
- ✅ SQL files can be version controlled and reviewed independently
- ✅ No SQL string concatenation or dynamic SQL in Python code
- ✅ Clear separation: SQL logic in `.sql` files, Python logic in test files
- ✅ Consistent with API and WebSocket endpoint patterns

### 2. PostgreSQL Functions with Composite Types

- **One function per test operation**: Function name follows `test_{operation}_{resource}_v4` pattern
- **RETURNS TABLE**: Functions return structured rows with explicit column types
- **Composite types**: Nested structures use composite types in `types` schema
- **Idempotent**: Files use `DROP FUNCTION IF EXISTS` followed by `CREATE OR REPLACE FUNCTION` (no transaction blocks)

### 3. Use execute_sql_typed() for All Database Operations

**⚠️ CRITICAL: Always Use execute_sql_typed(), Never Direct SQL Execution**

- **All database operations**: Use `execute_sql_typed()` for reads, writes, setup, and teardown
- **Type safety**: Auto-generated types from SQL introspection
- **No raw queries**: Never use `db.fetchval()`, `db.fetchrow()`, `db.fetch()`, or `db.execute()` with SQL strings
- **Consistent pattern**: Same pattern as API and WebSocket endpoints

### 4. Test SQL File Organization

**Directory Structure:**
```
server/tests/sql/v4/integration/
├── conftest/              # Common test setup functions
│   ├── test_get_superadmin_alias_v4_complete.sql
│   └── test_create_test_profile_v4_complete.sql
├── helpers/               # Test helper functions
│   ├── test_get_or_create_test_department_v4_complete.sql
│   └── test_get_or_create_test_profile_v4_complete.sql
├── api/                   # API test setup functions
│   └── {resource}/
│       ├── test_create_{resource}_v4_complete.sql
│       └── test_setup_{resource}_context_v4_complete.sql
├── socket/                # WebSocket test setup functions
│   └── {resource}/
│       ├── test_create_{resource}_attempt_v4_complete.sql
│       └── test_setup_{resource}_context_v4_complete.sql
└── infra/                 # Infrastructure test setup functions
    └── {category}/
        └── test_setup_{category}_context_v4_complete.sql
```

### 5. Type Generation for Test SQL

- **Auto-detection**: `execute_sql_typed()` detects if SQL file contains a function
- **Introspection**: Queries `pg_proc` and `pg_type` to extract function signatures
- **Pydantic models**: Generates `{FunctionName}SqlParams`, `{FunctionName}SqlRow`
- **Type location**: Types generated in `server/tests/sql/types.py` (separate from `server/app/sql/types.py`)

## Common Patterns

### Pattern 1: Simple Test Setup Function

```sql
-- tests/sql/v4/integration/queries/conftest/test_get_superadmin_alias_v4_complete.sql
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_superadmin_alias_v4();

-- Create function
CREATE OR REPLACE FUNCTION test_get_superadmin_alias_v4()
RETURNS TABLE (
    profile_id uuid,
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        p.id as profile_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.role = 'superadmin'::profile_type
    LIMIT 1;
$$;
```

**Usage in Test:**
```python
from app.sql.types import TestGetSuperadminAliasV4SqlParams, TestGetSuperadminAliasV4SqlRow
from app.utils.sql_helper import execute_sql_typed

async def test_example(db: asyncpg.Connection) -> None:
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/conftest/test_get_superadmin_alias_v4_complete.sql",
        params=None,  # No parameters
    )
    profile_id = result.profile_id
    actor_name = result.actor_name
```

### Pattern 2: Test Setup Function with Parameters

```sql
-- tests/sql/v4/integration/queries/api/agents/test_create_test_agent_v4_complete.sql
DROP FUNCTION IF EXISTS test_create_test_agent_v4(uuid, text, text, uuid);

CREATE TYPE types.test_create_test_agent_v4_result AS (
    agent_id uuid,
    name text,
    model_id uuid,
    created_at timestamptz
);

CREATE OR REPLACE FUNCTION test_create_test_agent_v4(
    profile_id uuid,
    name text,
    description text,
    model_id uuid
)
RETURNS TABLE (
    agent_id uuid,
    name text,
    model_id uuid,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO agents (name, description, model_id, active, role)
    VALUES (name, description, model_id, true, 'assistant'::agent_role)
    RETURNING id, name, model_id, created_at;
$$;
```

**Usage in Test:**
```python
from app.sql.types import (
    TestCreateTestAgentV4SqlParams,
    TestCreateTestAgentV4SqlRow,
)
from app.utils.sql_helper import execute_sql_typed

async def test_create_agent(db: asyncpg.Connection) -> None:
    # Get model_id first (using another test function)
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/conftest/test_get_first_model_v4_complete.sql",
        params=None,
    )
    
    # Create test agent
    params = TestCreateTestAgentV4SqlParams(
        profile_id=profile_id,
        name="Test Agent",
        description="Test Description",
        model_id=model_result.model_id,
    )
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_agent_v4_complete.sql",
        params=params,
    )
    assert result.agent_id is not None
    assert result.name == "Test Agent"
```

### Pattern 3: Complex Test Setup with Composite Types

```sql
-- tests/sql/v4/integration/queries/socket/simulations/test_create_simulation_attempt_v4_complete.sql
DROP FUNCTION IF EXISTS test_create_simulation_attempt_v4(uuid, uuid, uuid);

CREATE TYPE types.test_create_simulation_attempt_v4_result AS (
    attempt_id uuid,
    chat_id uuid,
    scenario_id uuid,
    profile_id uuid,
    department_id uuid,
    created_at timestamptz
);

CREATE OR REPLACE FUNCTION test_create_simulation_attempt_v4(
    profile_id uuid,
    department_id uuid,
    scenario_id uuid DEFAULT NULL
)
RETURNS TABLE (
    attempt_id uuid,
    chat_id uuid,
    scenario_id uuid,
    profile_id uuid,
    department_id uuid,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_scenario AS (
        INSERT INTO scenarios (name, description, active)
        SELECT 'Test Scenario', 'Test Description', true
        WHERE scenario_id IS NULL
        RETURNING id
    ),
    scenario_to_use AS (
        SELECT COALESCE(scenario_id, (SELECT id FROM new_scenario LIMIT 1)) as id
    ),
    new_attempt AS (
        INSERT INTO attempts (profile_id, department_id, scenario_id, active)
        SELECT 
            test_create_simulation_attempt_v4.profile_id,
            test_create_simulation_attempt_v4.department_id,
            st.id,
            true
        FROM scenario_to_use st
        RETURNING id, scenario_id
    ),
    new_chat AS (
        INSERT INTO chats (attempt_id, active)
        SELECT id, true
        FROM new_attempt
        RETURNING id as chat_id, attempt_id
    )
    SELECT 
        na.id as attempt_id,
        nc.chat_id,
        na.scenario_id,
        test_create_simulation_attempt_v4.profile_id,
        test_create_simulation_attempt_v4.department_id,
        now() as created_at
    FROM new_attempt na
    JOIN new_chat nc ON nc.attempt_id = na.id;
$$;
```

**Usage in Test:**
```python
from app.sql.types import (
    TestCreateSimulationAttemptV4SqlParams,
    TestCreateSimulationAttemptV4SqlRow,
)
from app.utils.sql_helper import execute_sql_typed

async def test_simulation_setup(db: asyncpg.Connection) -> None:
    # Get test profile and department (using helper functions)
    profile_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/helpers/test_get_or_create_test_profile_v4_complete.sql",
        params=None,
    )
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/helpers/test_get_or_create_test_department_v4_complete.sql",
        params=None,
    )
    
    # Create simulation attempt
    params = TestCreateSimulationAttemptV4SqlParams(
        profile_id=profile_result.profile_id,
        department_id=dept_result.department_id,
        scenario_id=None,  # Will create new scenario
    )
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/socket/simulations/test_create_simulation_attempt_v4_complete.sql",
        params=params,
    )
    assert result.attempt_id is not None
    assert result.chat_id is not None
```

## Common Pitfalls

### Pitfall 1: Inline SQL in Tests

```python
# ❌ BAD: Inline SQL
async def test_create_agent(db: asyncpg.Connection) -> None:
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, model_id) VALUES($1, $2, $3) RETURNING id",
        "Test Agent",
        "Test Description",
        model_id,
    )
    assert agent_id is not None

# ✅ GOOD: Use SQL file with typed function
async def test_create_agent(db: asyncpg.Connection) -> None:
    params = TestCreateTestAgentV4SqlParams(
        profile_id=profile_id,
        name="Test Agent",
        description="Test Description",
        model_id=model_id,
    )
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_agent_v4_complete.sql",
        params=params,
    )
    assert result.agent_id is not None
```

### Pitfall 2: Using Raw SQL Execution

```python
# ❌ BAD: Raw SQL execution
async def test_get_agent(db: asyncpg.Connection) -> None:
    row = await db.fetchrow(
        "SELECT id, name FROM agents WHERE id = $1",
        agent_id,
    )
    assert row["name"] == "Test Agent"

# ✅ GOOD: Use execute_sql_typed()
async def test_get_agent(db: asyncpg.Connection) -> None:
    params = TestGetTestAgentV4SqlParams(agent_id=agent_id)
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_test_agent_v4_complete.sql",
        params=params,
    )
    assert result.name == "Test Agent"
```

### Pitfall 3: Manual Type Definitions

```python
# ❌ BAD: Manual type definition
class TestAgentResult(BaseModel):
    agent_id: uuid.UUID
    name: str

# ✅ GOOD: Use auto-generated types
from app.sql.types import TestCreateTestAgentV4SqlRow
# Types auto-generated from SQL introspection
```

### Pitfall 4: SQL Files Without Functions

```sql
-- ❌ BAD: Raw SQL query
-- tests/sql/v4/integration/queries/api/agents/test_get_agent.sql
SELECT id, name FROM agents WHERE id = $1;

-- ✅ GOOD: PostgreSQL function
-- tests/sql/v4/integration/queries/api/agents/test_get_test_agent_v4_complete.sql
DROP FUNCTION IF EXISTS test_get_test_agent_v4(uuid);
CREATE OR REPLACE FUNCTION test_get_test_agent_v4(agent_id uuid)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
AS $$
    SELECT id, name FROM agents WHERE id = agent_id;
$$;
```

## Test Helper Functions

### Common Helpers Pattern

Create reusable helper functions in `tests/sql/v4/integration/queries/helpers/`:

```sql
-- tests/sql/v4/integration/queries/helpers/test_get_or_create_test_profile_v4_complete.sql
DROP FUNCTION IF EXISTS test_get_or_create_test_profile_v4(text);

CREATE OR REPLACE FUNCTION test_get_or_create_test_profile_v4(
    email text DEFAULT 'test@example.com'
)
RETURNS TABLE (
    profile_id uuid,
    email text,
    role text
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO profiles (first_name, last_name, role)
    SELECT 'Test', 'User', 'member'::profile_type
    WHERE NOT EXISTS (
        SELECT 1 FROM profile_emails pe
        JOIN profiles p ON p.id = pe.profile_id
        WHERE pe.email = test_get_or_create_test_profile_v4.email
    )
    RETURNING id, test_get_or_create_test_profile_v4.email, role::text
    UNION ALL
    SELECT p.id, pe.email, p.role::text
    FROM profiles p
    JOIN profile_emails pe ON pe.profile_id = p.id
    WHERE pe.email = test_get_or_create_test_profile_v4.email
    LIMIT 1;
$$;
```

## conftest.py Pattern

Update `conftest.py` to use SQL files for common setup:

```python
from app.sql.types import TestGetSuperadminAliasV4SqlRow
from app.utils.sql_helper import execute_sql_typed

@pytest.fixture
async def superadmin_profile(db: asyncpg.Connection) -> TestGetSuperadminAliasV4SqlRow:
    """Get superadmin profile using typed SQL function."""
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/conftest/test_get_superadmin_alias_v4_complete.sql",
        params=None,
    )
    return result
```

## Testing Checklist

### SQL & Types

- [ ] **All SQL in files** - No inline SQL strings in test code
- [ ] **PostgreSQL functions** - All SQL files define functions, not raw queries
- [ ] **Function naming** - Functions follow `test_{operation}_{resource}_v4` pattern
- [ ] **Composite types** - Complex structures use composite types in `types` schema
- [ ] **Idempotent** - SQL files use `DROP FUNCTION IF EXISTS` followed by `CREATE OR REPLACE FUNCTION` (no transaction blocks)
- [ ] **Type generation** - Types generated correctly in `server/tests/sql/types.py`
- [ ] **No JSONB** - Use composite types instead of JSONB

### Test Code

- [ ] **execute_sql_typed()** - All database operations use `execute_sql_typed()`
- [ ] **No raw SQL** - Never use `db.fetchval()`, `db.fetchrow()`, `db.fetch()`, or `db.execute()` with SQL strings
- [ ] **Typed parameters** - Use auto-generated `{FunctionName}SqlParams` types
- [ ] **Typed results** - Use auto-generated `{FunctionName}SqlRow` types
- [ ] **SQL file paths** - All SQL paths use `tests/sql/v4/integration/` prefix

### File Organization

- [ ] **Directory structure** - SQL files organized by category (conftest, helpers, api, socket, infra)
- [ ] **File naming** - Files follow `test_{operation}_{resource}_v4_complete.sql` pattern
- [ ] **One function per file** - Each SQL file defines exactly one function

## Migration from Inline SQL

When migrating existing tests:

1. **Identify inline SQL** - Find all `db.fetchval()`, `db.fetchrow()`, `db.fetch()`, `db.execute()` calls
2. **Create SQL file** - Create PostgreSQL function in `tests/sql/v4/integration/`
3. **Generate types** - Run type generation to create `SqlParams` and `SqlRow` types
4. **Update test** - Replace inline SQL with `execute_sql_typed()` call
5. **Verify types** - Ensure types are correctly generated and used

## Benefits

1. **Strong Typing**: PostgreSQL enforces types at database level, Pydantic enforces at test level
2. **Type Safety**: All types generated from SQL, no drift between SQL and Python
3. **Maintainability**: Single SQL file, clear function signature, idempotent migrations
4. **Consistency**: Same pattern as API and WebSocket endpoints
5. **Reusability**: Test SQL functions can be reused across multiple tests
6. **Version Control**: SQL files can be reviewed independently
7. **No SQL Injection**: Parameterized functions prevent SQL injection

## Reference Implementation

See `server/tests/integration/api/v4/` for examples of tests using SQL files with typed functions.

See `server/tests/sql/v4/integration/` for examples of test SQL functions.


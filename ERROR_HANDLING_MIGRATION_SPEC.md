# Error Handling Migration Spec: Implementing `handle_route_error` Pattern

## Overview
Migrate all API routes from generic `raise HTTPException(status_code=500, detail=str(e))` to structured error handling using `handle_route_error()` utility.

**Status**: ~122 routes remaining (6 routes already migrated as examples)

## Goals
- Consistent error logging across all routes
- SQL errors logged with query and parameters
- All errors logged with stack traces and route context
- Better debugging experience for developers

## Route Patterns

### Pattern 1: Routes with Request Parameter + SQL Query
**Example**: `parameters/detail_default.py`, `rubrics/detail.py`

**Characteristics**:
- Has `http_request: Request` parameter
- Executes SQL queries
- May have caching

**Transformation Steps**:
1. Import: `from app.utils.error_handler import handle_route_error`
2. Add type import: `from typing import Annotated, Any` (if not present)
3. Add Request import: `from fastapi import ..., Request` (if not present)
4. Track SQL: Add `sql_query: str | None = None` and `sql_params: tuple[Any, ...] | None = None` before try block
5. Capture SQL: Assign `sql_query = load_sql(...)` and `sql_params = (...)` before execution
6. Replace exception handler: Replace `raise HTTPException(status_code=500, detail=str(e))` with `handle_route_error(...)`

**Example**:
```python
# BEFORE
try:
    sql = load_sql("sql/v3/resource/operation.sql")
    result = await conn.fetchrow(sql, param1, param2)
    # ... processing ...
    return response_data
except HTTPException:
    raise
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

# AFTER
from app.utils.error_handler import handle_route_error
from typing import Annotated, Any
from fastapi import ..., Request

sql_query: str | None = None
sql_params: tuple[Any, ...] | None = None

try:
    sql_query = load_sql("sql/v3/resource/operation.sql")
    sql_params = (param1, param2)
    result = await conn.fetchrow(sql_query, param1, param2)
    # ... processing ...
    return response_data
except HTTPException:
    raise
except Exception as e:
    handle_route_error(
        error=e,
        route_path=http_request.url.path,
        operation="function_name",
        sql_query=sql_query,
        sql_params=sql_params,
        request=http_request,
    )
```

---

### Pattern 2: Routes WITHOUT Request Parameter + SQL Query
**Example**: `agents/update.py`, `providers/update.py`

**Characteristics**:
- No `Request` parameter
- Executes SQL queries
- Need to add `Request` parameter

**Transformation Steps**:
1. Import: `from app.utils.error_handler import handle_route_error`
2. Add type import: `from typing import Annotated, Any` (if not present)
3. Add Request import: `from fastapi import ..., Request` (if not present)
4. Add Request parameter: Add `http_request: Request` to function signature
5. Track SQL: Add `sql_query: str | None = None` and `sql_params: tuple[Any, ...] | None = None` before try block
6. Capture SQL: Assign `sql_query = load_sql(...)` and `sql_params = (...)` before execution
7. Replace exception handler: Replace `raise HTTPException(status_code=500, detail=str(e))` with `handle_route_error(...)`

**Example**:
```python
# BEFORE
@router.post("/update", response_model=UpdateResponse)
async def update_resource(
    request: UpdateRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateResponse:
    try:
        sql = load_sql("sql/v3/resource/update.sql")
        result = await conn.fetchrow(sql, request.id, request.name)
        # ... processing ...
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# AFTER
from app.utils.error_handler import handle_route_error
from typing import Annotated, Any
from fastapi import ..., Request

@router.post("/update", response_model=UpdateResponse)
async def update_resource(
    request: UpdateRequest,
    http_request: Request,  # ADD THIS
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateResponse:
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        sql_query = load_sql("sql/v3/resource/update.sql")
        sql_params = (request.id, request.name)
        result = await conn.fetchrow(sql_query, request.id, request.name)
        # ... processing ...
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_resource",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
```

---

### Pattern 3: Routes with Transactions
**Example**: `parameters/create.py`, `documents/update.py`

**Characteristics**:
- Uses `async with transaction(conn):` or `async with conn.transaction():`
- SQL query inside transaction block
- May have multiple SQL queries

**Transformation Steps**:
1. Follow Pattern 1 or 2 steps
2. Track SQL: Capture the primary SQL query (usually the main operation)
3. If multiple queries: Track the one most likely to fail or the main operation
4. Place `sql_query` and `sql_params` assignments inside transaction block before the query

**Example**:
```python
# BEFORE
try:
    async with transaction(conn):
        sql = load_sql("sql/v3/resource/create.sql")
        result = await conn.fetchrow(sql, param1, param2)
        # ... more operations ...
    return response_data
except HTTPException:
    raise
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

# AFTER
sql_query: str | None = None
sql_params: tuple[Any, ...] | None = None

try:
    async with transaction(conn):
        sql_query = load_sql("sql/v3/resource/create.sql")
        sql_params = (param1, param2)
        result = await conn.fetchrow(sql_query, param1, param2)
        # ... more operations ...
    return response_data
except HTTPException:
    raise
except Exception as e:
    handle_route_error(
        error=e,
        route_path=http_request.url.path,
        operation="create_resource",
        sql_query=sql_query,
        sql_params=sql_params,
        request=http_request,
    )
```

---

### Pattern 4: Routes with Multiple Exception Handlers
**Example**: `scenarios/update.py`, `simulations/update.py`

**Characteristics**:
- Has `except ValueError` or other specific exception handlers
- Generic `except Exception` at the end

**Transformation Steps**:
1. Follow Pattern 1 or 2 steps
2. Keep specific exception handlers (ValueError, etc.) unchanged
3. Only replace the final `except Exception as e:` handler

**Example**:
```python
# BEFORE
except HTTPException:
    raise
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

# AFTER
except HTTPException:
    raise
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    handle_route_error(
        error=e,
        route_path=http_request.url.path,
        operation="function_name",
        sql_query=sql_query,
        sql_params=sql_params,
        request=http_request,
    )
```

---

### Pattern 5: Routes with Existing Logging
**Example**: `providers/update.py` (has `logger.error()`)

**Characteristics**:
- Already has `logger.error()` calls
- Still uses generic `raise HTTPException(status_code=500, detail=str(e))`

**Transformation Steps**:
1. Follow Pattern 1 or 2 steps
2. Remove existing `logger.error()` calls (handled by `handle_route_error`)
3. Replace exception handler with `handle_route_error()`

**Example**:
```python
# BEFORE
except Exception as e:
    import logging
    logger = logging.getLogger(__name__)
    logger.error(f"Provider update error: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail=str(e))

# AFTER
except Exception as e:
    handle_route_error(
        error=e,
        route_path=http_request.url.path,
        operation="update_provider",
        sql_query=sql_query,
        sql_params=sql_params,
        request=http_request,
    )
```

---

### Pattern 6: Routes WITHOUT SQL Queries
**Example**: Routes that only do validation or call other functions

**Characteristics**:
- No SQL queries executed
- May call other functions or do validation only

**Transformation Steps**:
1. Import: `from app.utils.error_handler import handle_route_error`
2. Add Request parameter if missing
3. Track SQL: Set `sql_query = None` and `sql_params = None` (no SQL to track)
4. Replace exception handler: Use `handle_route_error()` without SQL params

**Example**:
```python
# BEFORE
try:
    # Validation only, no SQL
    if not request.field:
        raise ValueError("Field required")
    return ResponseData(success=True)
except HTTPException:
    raise
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

# AFTER
sql_query: str | None = None
sql_params: tuple[Any, ...] | None = None

try:
    # Validation only, no SQL
    if not request.field:
        raise ValueError("Field required")
    return ResponseData(success=True)
except HTTPException:
    raise
except Exception as e:
    handle_route_error(
        error=e,
        route_path=http_request.url.path,
        operation="function_name",
        sql_query=sql_query,  # None - no SQL
        sql_params=sql_params,  # None - no SQL
        request=http_request,
    )
```

---

## Implementation Checklist

For each route file:

- [ ] **Step 1**: Add imports
  - [ ] `from app.utils.error_handler import handle_route_error`
  - [ ] `from typing import Annotated, Any` (if not present)
  - [ ] `from fastapi import ..., Request` (if not present)

- [ ] **Step 2**: Add Request parameter (if missing)
  - [ ] Add `http_request: Request` to function signature
  - [ ] Update function signature line

- [ ] **Step 3**: Track SQL variables
  - [ ] Add `sql_query: str | None = None` before try block
  - [ ] Add `sql_params: tuple[Any, ...] | None = None` before try block

- [ ] **Step 4**: Capture SQL (if applicable)
  - [ ] Find `load_sql()` call
  - [ ] Assign to `sql_query = load_sql(...)`
  - [ ] Build tuple/list of parameters → `sql_params = (param1, param2, ...)`
  - [ ] Update SQL execution to use `sql_query` and `*sql_params` or individual params

- [ ] **Step 5**: Replace exception handler
  - [ ] Find `except Exception as e:`
  - [ ] Find `raise HTTPException(status_code=500, detail=str(e))`
  - [ ] Replace with `handle_route_error()` call
  - [ ] Use function name for `operation` parameter
  - [ ] Use `http_request.url.path` for `route_path`
  - [ ] Pass `sql_query` and `sql_params` (may be None)
  - [ ] Pass `request=http_request`

- [ ] **Step 6**: Remove old logging (if present)
  - [ ] Remove any `logger.error()` calls in exception handler
  - [ ] Remove `import logging` if no longer needed

- [ ] **Step 7**: Verify
  - [ ] Run `make typecheck` - should pass
  - [ ] Run `make lint` - should pass
  - [ ] Test route manually or run integration tests

---

## Batch Processing Strategy

### Phase 1: High-Value Routes (Priority)
Focus on routes that are:
- Frequently used (detail, list, create, update)
- Critical for user experience
- Already have some error handling

**Target**: ~30 routes
- `agents/*` (detail, list, update, delete)
- `parameters/*` (update, delete, list)
- `rubrics/*` (update, delete, list)
- `scenarios/*` (update, delete, list)
- `simulations/*` (update, delete, list)
- `personas/*` (update, delete, list)

### Phase 2: Standard CRUD Routes
All remaining create/update/delete/list routes

**Target**: ~50 routes

### Phase 3: Specialized Routes
Detail routes, search routes, bulk operations, etc.

**Target**: ~42 routes

---

## Verification Commands

After updating each route or batch:

```bash
# Type checking
make typecheck

# Linting
make lint

# Run integration tests for updated routes
make test-integration

# Check for remaining routes
grep -r "raise HTTPException(status_code=500, detail=str(e))" server/app/api/v3 --include="*.py" | wc -l
```

---

## Examples Reference

**Already Migrated (Use as Reference)**:
- `server/app/api/v3/parameters/detail_default.py` - Pattern 1
- `server/app/api/v3/parameters/detail.py` - Pattern 1
- `server/app/api/v3/parameters/create.py` - Pattern 3
- `server/app/api/v3/feedback/create.py` - Pattern 2
- `server/app/api/v3/rubrics/detail.py` - Pattern 1
- `server/app/api/v3/agents/create.py` - Pattern 2 + 3

---

## Common Pitfalls

1. **Forgetting Request parameter**: Some routes don't have `Request` - must add it
2. **Wrong operation name**: Use the actual function name, not route path
3. **SQL params mismatch**: Ensure `sql_params` tuple matches actual SQL execution
4. **Multiple SQL queries**: Track the primary/main query, not all queries
5. **Transaction scope**: Place SQL tracking inside transaction block if query is there
6. **Type imports**: Don't forget `from typing import Any` for tuple type hints

---

## Success Criteria

- [ ] All routes use `handle_route_error()` instead of generic exception handler
- [ ] All routes have proper SQL query/parameter tracking
- [ ] All routes have `Request` parameter for context
- [ ] `make typecheck` passes with no errors
- [ ] `make lint` passes with no errors
- [ ] Integration tests pass
- [ ] Error logs show SQL queries and parameters for SQL errors
- [ ] Error logs show stack traces for all errors

---

## Estimated Effort

- **Per route**: ~5-10 minutes
- **Total routes**: ~122 remaining
- **Total time**: ~10-20 hours
- **Batch approach**: Can be done incrementally, route by route or resource by resource

---

## Notes

- This is a mechanical transformation - patterns are consistent
- Can be automated with a script (future enhancement)
- Each route can be updated independently
- No breaking changes - only improves error handling
- Backward compatible - error responses still work the same way


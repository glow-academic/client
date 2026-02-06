# Resource Endpoint Cleanup Plan

## Overview

This plan fixes all resource endpoints to follow a clean pattern:
- **get.py**: Fetches by IDs, queries ONLY the `*_resource` table
- **search.py**: Searches with filters, queries ONLY the `*_resource` table (with optional efficient connection table joins for suggest_source)

## Key Findings

1. **All resource tables already have denormalized `name` and `description` columns** - no need to join junction tables
2. **Connection tables exist** (`*_calls_connection`) for all resources - can use for suggest_source
3. **Path for suggest_source**: `*_calls_connection` → `calls_entry` → `runs_entry.group_id` (no MVs needed)

---

## Phase 1: Fix Existing SQL Files (High Priority)

### 1.1 Critical: Fix simulations search
**File**: `server/app/sql/v4/queries/resources/simulations/search_simulations_complete.sql`
**Issues**:
- Uses `simulation_artifact` instead of `simulations_resource`
- Joins 12+ tables for flags, time_limits, names, descriptions via junctions
- Uses `calls_entry` and `runs_entry` views

**Fix**:
- Query `simulations_resource` directly (has `name`, `description`, `active`, `generated`)
- For suggest_source='recent': `simulations_calls_connection` → `calls_entry` → `runs_entry.group_id`
- Remove all junction table joins

---

### 1.2 High: Fix departments SQL
**Files**:
- `server/app/sql/v4/queries/resources/departments/get_departments_complete.sql`
- `server/app/sql/v4/queries/resources/departments/search_departments_complete.sql`

**Issues**: Joins `department_names_junction`, `names_resource`, `department_descriptions_junction`, `descriptions_resource`, `department_flags_junction`, `flags_resource`

**Fix**:
- `departments_resource` already has `name`, `description`, `active` columns
- Remove all junction joins
- For search suggest_source: `departments_calls_connection` → `calls_entry` → `runs_entry.group_id`

---

### 1.3 High: Fix fields SQL
**Files**:
- `server/app/sql/v4/queries/resources/fields/get_fields_complete.sql`
- `server/app/sql/v4/queries/resources/fields/search_fields_complete.sql`

**Issues**: Same pattern - joins junction tables for name/description/flags

**Fix**:
- `fields_resource` already has `name`, `description`, `value`, `active` columns
- Remove all junction joins
- For search suggest_source: `fields_calls_connection` → `calls_entry` → `runs_entry.group_id`

---

### 1.4 High: Fix documents SQL
**File**: `server/app/sql/v4/queries/resources/documents/get_documents_complete.sql`

**Issues**: Joins `document_names_junction`, `document_descriptions_junction`, `document_uploads_resource`, `uploads_resource`

**Fix**:
- `documents_resource` already has `name`, `description`, `upload_id` columns
- For upload URL: may need single join to `uploads_resource` (acceptable - direct FK)
- Remove all junction joins

---

### 1.5 High: Fix parameter_fields SQL
**Files**:
- `server/app/sql/v4/queries/resources/parameter_fields/get_parameter_fields_complete.sql`
- `server/app/sql/v4/queries/resources/parameter_fields/search_parameter_fields_complete.sql`

**Issues**: 9-11 table joins for metadata

**Fix**:
- Check if `parameter_fields_resource` has denormalized columns
- Remove junction joins, use direct columns

---

### 1.6 Medium: Fix search files with suggest_source pattern
These files join `view_calls_entry`, `view_runs_entry` when they should use entry tables directly:

| File | Fix |
|------|-----|
| `names/search_names_complete.sql` | `names_calls_connection` → `calls_entry` → `runs_entry.group_id` |
| `descriptions/search_descriptions_complete.sql` | Same pattern |
| `colors/search_colors_complete.sql` | Same pattern |
| `icons/search_icons_complete.sql` | Same pattern |
| `instructions/search_instructions_complete.sql` | Same pattern |
| `examples/search_examples_complete.sql` | Same pattern |
| `personas/search_personas_complete.sql` | Remove artifact/flag joins, use `personas_resource.active` |

---

### 1.7 Medium: Fix other get files with minor joins
| File | Issue | Fix |
|------|-------|-----|
| `roles/get_roles_complete.sql` | LEFT JOINs `icons_resource`, `colors_resource` | Check if `roles_resource` has `icon_value`, `color_hex` denormalized |
| `parameters/get_parameters_complete.sql` | EXISTS on `conditional_parameters_resource` | Check if flag denormalized on `parameters_resource` |
| `scenarios/get_scenarios_complete.sql` | Joins `scenario_artifact` | Use `scenarios_resource` directly |
| `cohorts/get_cohorts_complete.sql` | Joins junction tables | Use `cohorts_resource` directly |
| `rubrics/get_rubrics_complete.sql` | Joins `scenario_rubrics_resource` | Use `rubrics_resource` directly |
| `scenario_flags/get_scenario_flags_complete.sql` | Joins `flags_resource` | Check denormalization |

---

## Phase 2: Create Missing Endpoints

### 2.1 Template Pattern for get.py

```python
"""Resource GET endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    Get{Resource}ApiRequest,
    Get{Resource}ApiResponse,
    Get{Resource}SqlParams,
    Get{Resource}SqlRow,
    QGet{Resource}V4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/{resource}/get_{resource}_complete.sql"

router = APIRouter()


async def get_{resource}_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGet{Resource}V4Item]:
    """Internal function to fetch {resource} by IDs."""
    if not ids:
        return []

    tags = ["resources", "{resource}"]
    cache_key_val = cache_key(
        "/api/v4/resources/{resource}/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGet{Resource}V4Item.model_validate(item) for item in cached.get("items", [])
            ]

    params = Get{Resource}SqlParams(ids=ids)
    result = cast(
        Get{Resource}SqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGet{Resource}V4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/{resource}/get",
    response_model=Get{Resource}ApiResponse,
)
async def get_{resource}(
    request: Get{Resource}ApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Get{Resource}ApiResponse:
    """Get {resource} resources by IDs."""
    tags = ["resources", "{resource}"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_{resource}_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return Get{Resource}ApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_{resource}",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
```

### 2.2 Template Pattern for search.py

```python
"""Resource SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGet{Resource}V4Item,
    Search{Resource}ApiRequest,
    Search{Resource}ApiResponse,
    Search{Resource}SqlParams,
    Search{Resource}SqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/{resource}/search_{resource}_complete.sql"

router = APIRouter()


async def search_{resource}_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    group_id: UUID | None = None,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[QGet{Resource}V4Item]:
    """Internal function to search {resource}."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "{resource}"]
    cache_key_val = cache_key(
        "/api/v4/resources/{resource}/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "group_id": str(group_id) if group_id else None,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGet{Resource}V4Item.model_validate(item) for item in cached.get("items", [])
            ]

    params = Search{Resource}SqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        group_id=group_id,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
    )
    result = cast(
        Search{Resource}SqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGet{Resource}V4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/{resource}/search",
    response_model=Search{Resource}ApiResponse,
)
async def search_{resource}(
    request: Search{Resource}ApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Search{Resource}ApiResponse:
    """Search {resource} resources."""
    tags = ["resources", "{resource}"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_{resource}_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.group_id,
            request.suggest_source,
            request.exclude_ids,
            bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return Search{Resource}ApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_{resource}",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
```

### 2.3 Template Pattern for SQL get

```sql
-- Get {resource} resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[])
-- Returns: items (array of {resource} resources)

-- Drop function if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_{resource}_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_{resource}_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_{resource}_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type
CREATE TYPE types.q_get_{resource}_v4_item AS (
    id uuid,
    name text,
    -- add other columns from {resource}_resource
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_{resource}_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_{resource}_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (r.id, r.name, COALESCE(r.generated, false))::types.q_get_{resource}_v4_item
        ORDER BY array_position(ids, r.id)
    ),
    ARRAY[]::types.q_get_{resource}_v4_item[]
) as items
FROM {resource}_resource r
WHERE r.id = ANY(ids)
  AND r.active = true;  -- if applicable
$$;
```

### 2.4 Template Pattern for SQL search

```sql
-- Search {resource} resources
-- Parameters: search, limit_count, offset_count, group_id, suggest_source, exclude_ids
-- Returns: items (array of {resource} resources)

-- Drop function if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_{resource}_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_{resource}_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_{resource}_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    group_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_{resource}_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.generated)::types.q_get_{resource}_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_{resource}_v4_item[]
) as items
FROM (
    SELECT r.id, r.name, COALESCE(r.generated, false) AS generated
    FROM {resource}_resource r
    WHERE r.active = true  -- if applicable
      AND r.name IS NOT NULL
      AND r.name != ''
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(r.name) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
      -- Suggest source filter (recent)
      AND (
          suggest_source = 'all'
          OR suggest_source IS NULL
          OR (
              suggest_source = 'recent'
              AND group_id IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM {resource}_calls_connection cc
                  JOIN calls_entry c ON c.id = cc.call_id
                  JOIN runs_entry run ON run.id = c.run_id
                  WHERE cc.{resource}_id = r.id
                    AND run.group_id = group_id
              )
          )
      )
    ORDER BY r.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
```

---

## Phase 2.5: Resources Needing get.py

Create get.py and SQL for these 32 resources:

| Resource | Priority | Notes |
|----------|----------|-------|
| agents | Medium | Non-creatable, internal |
| args | Low | Internal |
| args_outputs | Low | Internal |
| auths | Medium | Non-creatable |
| emails | Low | Internal |
| endpoints | Low | Internal |
| evals | Medium | Non-creatable |
| group_positions | Low | Internal |
| group_rubrics | Low | Internal |
| groups | Medium | Non-creatable |
| items | Low | Internal |
| keys | Low | Internal |
| modalities | Medium | Non-creatable |
| models | Medium | Non-creatable |
| points | Low | Internal |
| pricing | Low | Internal |
| prompts | Low | Internal |
| protocols | Low | Internal |
| providers | Medium | Non-creatable |
| qualities | Medium | Non-creatable |
| reasoning_levels | Medium | Non-creatable |
| request_limits | Low | Internal |
| run_positions | Low | Internal |
| run_rubrics | Low | Internal |
| runs | Medium | Non-creatable |
| slugs | Low | Internal |
| temperature_levels | Medium | Non-creatable |
| thresholds | Medium | Non-creatable |
| tools | Medium | Non-creatable |
| uploads | Medium | May need special handling for file URLs |
| values | Low | Internal |
| voices | Low | Internal |

---

## Phase 2.6: Resources Needing search.py

Create search.py and SQL for these 41 resources (includes the 32 above plus 9 more):

Additional resources needing search.py only:
| Resource | Priority | Notes |
|----------|----------|-------|
| cohorts | Medium | Has get.py |
| objectives | Medium | Has get.py |
| options | Medium | Has get.py |
| profiles | Medium | Has get.py |
| roles | Medium | Has get.py |
| rubrics | Medium | Has get.py |
| settings | Medium | Has get.py |
| standard_groups | Low | Has create.py |
| standards | Medium | Has get.py |

---

## Phase 3: Update Router Registration

Update `server/app/api/v4/resources/__init__.py` to include all new routers:

```python
# For each new resource with get.py:
from app.api.v4.resources.{resource}.get import router as {resource}_get_router
router.include_router({resource}_get_router)

# For each new resource with search.py:
from app.api.v4.resources.{resource}.search import router as {resource}_search_router
router.include_router({resource}_search_router)
```

---

## Phase 4: Generate Types

After creating/updating SQL files:

1. Run migrations to apply SQL changes:
   ```bash
   make migrate
   ```

2. Generate Python types:
   ```bash
   make openapi-gen
   ```

3. Generate client types:
   ```bash
   make gen-client-types
   ```

---

## Phase 5: Testing

1. Test each endpoint manually:
   ```bash
   curl -X POST http://localhost:8000/api/v4/resources/{resource}/get \
     -H "Content-Type: application/json" \
     -H "X-Profile-Id: <test-profile-id>" \
     -d '{"ids": ["<valid-uuid>"]}'
   ```

2. Test search with suggest_source:
   ```bash
   curl -X POST http://localhost:8000/api/v4/resources/{resource}/search \
     -H "Content-Type: application/json" \
     -H "X-Profile-Id: <test-profile-id>" \
     -d '{"search": "test", "suggest_source": "recent", "group_id": "<group-uuid>"}'
   ```

---

## Execution Order

1. **Phase 1.1**: Fix simulations search (critical)
2. **Phase 1.2-1.5**: Fix high-priority SQL files (departments, fields, documents, parameter_fields)
3. **Phase 1.6**: Fix suggest_source pattern in search files
4. **Phase 1.7**: Fix minor join issues
5. **Phase 2**: Create missing endpoints (start with Medium priority)
6. **Phase 3**: Update router registration
7. **Phase 4**: Generate types
8. **Phase 5**: Testing

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| SQL files to fix (remove joins) | ~20 | Rewrite to use denormalized columns |
| get.py to create | 32 | Use template |
| search.py to create | 41 | Use template |
| Router registrations to add | ~73 | Add imports |

**Estimated effort**: 2-3 days for a focused effort

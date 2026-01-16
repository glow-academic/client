"""Field get endpoint - v4 API following DHH principles.
Unified endpoint that handles both new (field_id = NULL) and detail (field_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetFieldApiRequest,
    GetFieldApiResponse,
    GetFieldSqlParams,
    GetFieldSqlRow,
    load_sql_query,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/fields/get_field_complete.sql"


router = APIRouter()


@router.post(
    "/get",
    response_model=GetFieldApiResponse,
    dependencies=[
        audit_activity(
            "field.get",
            "{{ actor.name }} {% if field %}viewed{% else %}opened new{% endif %} field{% if field %} '{{ field.name }}'{% endif %}",
        )
    ],
)
async def get_field(
    request: GetFieldApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetFieldApiResponse:
    """Get field information - handles both new (field_id = NULL) and detail (field_id provided)."""
    tags = ["fields"]  # From router tags

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetFieldApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Extract params from API request
        draft_id = request.draft_id
        field_id = request.field_id  # Can be NULL for new mode

        # Convert API request to SQL params (add profile_id from header)
        params = GetFieldSqlParams(
            field_id=field_id,
            profile_id=profile_id,
            draft_id=draft_id,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            GetFieldSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
            # Only add field to audit context if field_id was provided (detail mode)
            if field_id and result.name:
                audit_ctx["field"] = {
                    "name": result.name,
                    "id": str(field_id),
                }
            audit_set(http_request, **audit_ctx)

        # Conditional validation based on mode
        if field_id is None:
            # New mode: check for valid departments (derive from departments array)
            departments_list = result.departments or []
            valid_department_ids = [
                d.department_id for d in departments_list if d.department_id
            ]
            if not valid_department_ids:
                raise HTTPException(
                    status_code=400, detail="No accessible departments found for user"
                )
        else:
            # Detail mode: check if field exists and has access
            if result.field_exists is False:
                raise HTTPException(
                    status_code=404, detail=f"Field {field_id} not found"
                )

            if not result.name:
                # Field exists but user doesn't have access
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this field. It may be restricted to other departments.",
                )

        # Convert SQL result to API response
        response_data = GetFieldApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_field",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

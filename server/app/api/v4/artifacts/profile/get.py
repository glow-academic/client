"""Profile get endpoint - v4 API following DHH principles.
Unified endpoint that handles both new (target_profile_id = NULL) and detail (target_profile_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetProfileApiRequest,
    GetProfileApiResponse,
    GetProfileSqlParams,
    GetProfileSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/profile/get_profile_complete.sql"


router = APIRouter()


def _extract_profile_websocket_context(result: GetProfileSqlRow) -> dict[str, Any]:
    """Build minimal generation context payload for websocket consumers."""
    payload = result.model_dump()
    context_keys = (
        "group_id",
        "trace_id",
        "run_id",
        "domains",
        "tools",
        "tool_ids",
        "domain_ids",
        "agent_ids",
        "department_id",
        "provider_id",
        "model_id",
        "resource_group_ids",
        "generation_context",
    )
    return {key: payload.get(key) for key in context_keys if payload.get(key) is not None}


async def get_profile_internal(
    conn: asyncpg.Connection,
    params: GetProfileSqlParams,
) -> GetProfileSqlRow:
    """Internal SQL fetch layer for profile get endpoint."""
    return cast(
        GetProfileSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        ),
    )


def get_profile_websocket(result: GetProfileSqlRow) -> dict[str, Any]:
    """Websocket wrapper layer for profile generation context."""
    return _extract_profile_websocket_context(result)


def get_profile_client(result: GetProfileSqlRow) -> GetProfileApiResponse:
    """Client/BFF wrapper layer for profile get response."""
    payload = result.model_dump()
    if "generation_context" in payload:
        payload["generation_context"] = get_profile_websocket(result)
    return GetProfileApiResponse.model_validate(payload)


@router.post(
    "/get",
    response_model=GetProfileApiResponse,
    dependencies=[
        audit_activity(
            "profile.get",
            "{{ actor.name }} {% if profile %}viewed{% else %}opened new{% endif %} profile{% if profile %} '{{ profile.name }}'{% endif %}",
        )
    ],
)
async def get_profile(
    request: GetProfileApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfileApiResponse:
    """Get profile information - handles both new (target_profile_id = NULL) and detail (target_profile_id provided)."""
    tags = ["profile"]  # From router tags

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetProfileApiResponse.model_validate(cached["data"])

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

        # Convert API request to SQL params (add profile_id from header)
        params = GetProfileSqlParams(
            profile_id=profile_id,
            **request.model_dump(),
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = await get_profile_internal(conn, params)

        # Validation: For detail mode, check if profile exists and user has access
        if request.target_profile_id is not None:
            if not result.profile_exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Profile not found: {request.target_profile_id}",
                )
            if not result.can_edit and result.disabled_reason:
                # User can view but not edit - this is handled by frontend via can_edit flag
                pass

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
            # Only add profile to audit context if target_profile_id was provided (detail mode)
            if request.target_profile_id:
                profile_name = result.name_resource.name if result.name_resource else ""
                audit_ctx["profile"] = {
                    "name": profile_name,
                    "id": str(result.profile_id) if result.profile_id else "",
                }
            audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        response_data = get_profile_client(result)

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
            operation="get_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

"""Cohort new endpoint - v4 API."""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetCohortNewApiRequest,
    GetCohortNewApiResponse,
    GetCohortNewSqlParams,
    GetCohortNewSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/cohorts/get_cohort_new_complete.sql"


router = APIRouter()


@router.post(
    "/new",
    response_model=GetCohortNewApiResponse,
    dependencies=[
        audit_activity("cohort.new", "{{ actor.name }} viewed new cohort form")
    ],
)
async def get_cohort_new(
    request: GetCohortNewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetCohortNewApiResponse:
    """Get default cohort detail with staff, simulations, and mappings."""
    tags = ["cohorts"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetCohortNewApiResponse.model_validate(cached["data"])

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
        params = GetCohortNewSqlParams(
            profile_id=uuid.UUID(profile_id),
            draft_id=request.draft_id
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = cast(
            GetCohortNewSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )
        
        # #region agent log - check draft payload
        if request.draft_id:
            draft_payload_raw = await conn.fetchval(
                "SELECT payload FROM drafts WHERE id = $1 AND profile_id = $2 AND resource_type = 'cohorts'",
                request.draft_id,  # Already a UUID, don't convert
                uuid.UUID(profile_id)
            )
            import json
            # Convert JSONB to dict if needed
            draft_payload = draft_payload_raw if isinstance(draft_payload_raw, dict) else json.loads(draft_payload_raw) if draft_payload_raw else None
            with open("/Users/ashoksaravanan/Coding/glow/.cursor/debug.log", "a") as f:
                f.write(json.dumps({
                    "location": "new.py:95",
                    "message": "draft payload check",
                    "data": {
                        "draft_id": str(request.draft_id),
                        "has_payload": draft_payload is not None,
                        "simulation_ids": draft_payload.get("simulation_ids") if draft_payload else None,
                        "simulation_ids_length": len(draft_payload.get("simulation_ids", [])) if draft_payload else 0,
                        "payload_keys": list(draft_payload.keys()) if draft_payload else [],
                        "result_simulation_ids": result.simulation_ids if result else None,
                        "result_simulation_ids_length": len(result.simulation_ids) if result and result.simulation_ids else 0,
                    },
                    "timestamp": int(__import__("time").time() * 1000),
                    "sessionId": "debug-session",
                    "hypothesisId": "E",
                }) + "\n")
        # #endregion

        if not result:
            raise HTTPException(
                status_code=404, detail="No cohort found for user's departments"
            )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert SQL result to API response (no manual conversion needed - SQL returns arrays)
        api_response = GetCohortNewApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_cohort_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

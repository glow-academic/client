"""Home overview endpoint - POST /home/overview"""

import json
import os
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetHomeOverviewApiRequest,
    GetHomeOverviewApiResponse,
    GetHomeOverviewSqlParams,
    GetHomeOverviewSqlRow,
)

# #region agent log
LOG_PATH = "/Users/ashoksaravanan/Coding/glow/.cursor/debug.log"
# #endregion

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/home/get_home_overview_complete.sql"

router = APIRouter()


@router.post(
    "/overview",
    response_model=GetHomeOverviewApiResponse,
    dependencies=[
        audit_activity("home.overview", "{{ actor.name }} viewed home overview")
    ],
)
async def get_home_overview(
    request: GetHomeOverviewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHomeOverviewApiResponse:
    """Get home overview with items and mappings.

    Home always shows general simulations only (no simulationFilters parameter).
    Bundle only returns top half (items + mappings), history is separate endpoint.
    """
    tags = ["home"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            # #region agent log
            try:
                with open(LOG_PATH, "a") as f:
                    f.write(json.dumps({
                        "sessionId": "debug-session",
                        "runId": "home-overview-cache-hit",
                        "hypothesisId": "CACHE",
                        "location": "overview.py:64",
                        "message": "Cache hit - returning cached data",
                        "data": {"cache_key": cache_key_val, "bypass_cache": bypass_cache},
                        "timestamp": int(__import__("time").time() * 1000)
                    }) + "\n")
            except Exception:
                pass
            # #endregion
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetHomeOverviewApiResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # #region agent log
        try:
            x_profile_id_header = http_request.headers.get("X-Profile-Id")
            with open(LOG_PATH, "a") as f:
                f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "home-overview-entry",
                    "hypothesisId": "A",
                    "location": "overview.py:65",
                    "message": "Request headers and URL",
                    "data": {
                        "url": str(http_request.url),
                        "x_profile_id_header": x_profile_id_header,
                        "host": http_request.headers.get("Host"),
                        "user_agent": http_request.headers.get("User-Agent")
                    },
                    "timestamp": int(__import__("time").time() * 1000)
                }) + "\n")
        except Exception:
            pass
        # #endregion
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        # #region agent log
        try:
            with open(LOG_PATH, "a") as f:
                f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "home-overview-entry",
                    "hypothesisId": "A",
                    "location": "overview.py:78",
                    "message": "Profile ID from state",
                    "data": {"profile_id": str(profile_id) if profile_id else None},
                    "timestamp": int(__import__("time").time() * 1000)
                }) + "\n")
        except Exception:
            pass
        # #endregion
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (add profile_id from header)
        # Use mode='json' to keep dates as ISO strings (SQL params model expects strings, not datetime objects)
        # Use double-star pattern - SQL handles defaults via COALESCE in params CTE
        # Note: model_dump(mode='json') returns strings for dates at runtime, but type checker infers datetime
        request_dict = request.model_dump(mode="json")
        # #region agent log
        try:
            with open(LOG_PATH, "a") as f:
                f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "home-overview-entry",
                    "hypothesisId": "B",
                    "location": "overview.py:77",
                    "message": "Request body parameters",
                    "data": {"request_dict": request_dict},
                    "timestamp": int(__import__("time").time() * 1000)
                }) + "\n")
        except Exception:
            pass
        # #endregion
        params = GetHomeOverviewSqlParams(**request_dict, profile_id=profile_id)  # type: ignore[arg-type]
        sql_params = params.to_tuple()
        # #region agent log
        try:
            with open(LOG_PATH, "a") as f:
                f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "home-overview-entry",
                    "hypothesisId": "C",
                    "location": "overview.py:143",
                    "message": "SQL params tuple with department_ids analysis",
                    "data": {
                        "sql_params": [str(p) for p in sql_params],
                        "params_dict": params.model_dump(),
                        "cohort_ids": list(params.cohort_ids) if params.cohort_ids else [],
                        "department_ids": list(params.department_ids) if params.department_ids else [],
                        "cohort_ids_count": len(params.cohort_ids) if params.cohort_ids else 0,
                        "department_ids_count": len(params.department_ids) if params.department_ids else 0,
                        "department_ids_empty": len(params.department_ids) == 0 if params.department_ids else True
                    },
                    "timestamp": int(__import__("time").time() * 1000)
                }) + "\n")
        except Exception:
            pass
        # #endregion

        # Execute query with typed helper - automatically detects and calls function if present
        # #region agent log
        try:
            # Construct the actual SQL query that will be executed
            function_call_sql = f'SELECT * FROM "public"."api_get_home_overview_v4"($1, $2, $3, $4, $5)'
            with open(LOG_PATH, "a") as f:
                f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "home-overview-entry",
                    "hypothesisId": "E",
                    "location": "overview.py:156",
                    "message": "SQL query being executed with exact parameters",
                    "data": {
                        "sql": function_call_sql,
                        "sql_path": SQL_PATH,
                        "sql_params": {
                            "start_date": str(sql_params[0]) if len(sql_params) > 0 else None,
                            "end_date": str(sql_params[1]) if len(sql_params) > 1 else None,
                            "profile_id": str(sql_params[2]) if len(sql_params) > 2 else None,
                            "cohort_ids": [str(cid) for cid in sql_params[3]] if len(sql_params) > 3 and sql_params[3] else [],
                            "department_ids": [str(did) for did in sql_params[4]] if len(sql_params) > 4 and sql_params[4] else []
                        },
                        "cohort_ids_count": len(sql_params[3]) if len(sql_params) > 3 and sql_params[3] else 0,
                        "department_ids_count": len(sql_params[4]) if len(sql_params) > 4 and sql_params[4] else 0
                    },
                    "timestamp": int(__import__("time").time() * 1000)
                }) + "\n")
        except Exception as e:
            try:
                with open(LOG_PATH, "a") as f:
                    f.write(json.dumps({
                        "sessionId": "debug-session",
                        "runId": "home-overview-entry",
                        "hypothesisId": "E",
                        "location": "overview.py:156",
                        "message": "SQL query logging error",
                        "data": {"error": str(e), "sql_params_len": len(sql_params) if sql_params else 0},
                        "timestamp": int(__import__("time").time() * 1000)
                    }) + "\n")
            except Exception:
                pass
        # #endregion
        result = cast(
            GetHomeOverviewSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )
        # #region agent log
        try:
            result_dict = result.model_dump()
            items = result_dict.get("items", [])
            items_summary = []
            for item in items[:3]:
                items_summary.append({
                    "simulation_name": item.get("simulation_name"),
                    "completion_pct": item.get("completion_pct"),
                    "in_progress_count": item.get("in_progress_count"),
                    "not_started_count": item.get("not_started_count"),
                    "status": item.get("status")
                })
            with open(LOG_PATH, "a") as f:
                f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "home-overview-entry",
                    "hypothesisId": "D",
                    "location": "overview.py:88",
                    "message": "SQL result summary with item details",
                    "data": {
                        "mode": result_dict.get("mode"),
                        "has_data": result_dict.get("has_data"),
                        "items_count": len(items),
                        "items_summary": items_summary,
                        "standard_groups_count": len(result_dict.get("standard_groups", [])),
                        "standards_count": len(result_dict.get("standards", [])),
                        "simulations_count": len(result_dict.get("simulations", []))
                    },
                    "timestamp": int(__import__("time").time() * 1000)
                }) + "\n")
        except Exception:
            pass
        # #endregion

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert SQL result to API response (no manual filtering needed - SQL handles it)
        api_response = GetHomeOverviewApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_home_overview",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

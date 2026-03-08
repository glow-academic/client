"""Get endpoint for leaderboard artifact — top sections (header metrics + accolades)."""

from datetime import datetime
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.common_context import resolve_common_context
from app.infra.globals import get_db, get_pool, get_redis_client
from app.infra.leaderboard_context import resolve_leaderboard_context
from app.infra.leaderboard_permissions import (
    build_leaderboard_sections_v3,
)
from app.routes.v5.api.main.leaderboard.types import (
    LeaderboardProfileResource,
    LeaderboardRequest,
    LeaderboardResources,
    LeaderboardResponse,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_filters(request: LeaderboardRequest) -> dict[str, Any]:
    """Parse common filters from leaderboard request."""
    parsed_start_date = (
        datetime.fromisoformat(request.start_date.replace("Z", "+00:00"))
        if request.start_date
        else None
    )
    parsed_end_date = (
        datetime.fromisoformat(request.end_date.replace("Z", "+00:00"))
        if request.end_date
        else None
    )

    cohort_ids_filter = (
        request.cohort_ids
        if request.cohort_ids
        else ([request.cohort_id] if request.cohort_id else None)
    )

    is_archived = bool(
        request.simulation_filters and "archived" in request.simulation_filters
    )
    if request.simulation_filters and "general" in request.simulation_filters:
        attempt_type = "general"
    elif request.simulation_filters and "practice" in request.simulation_filters:
        attempt_type = "practice"
    else:
        attempt_type = "general"

    return {
        "date_from": parsed_start_date.date() if parsed_start_date else None,
        "date_to": parsed_end_date.date() if parsed_end_date else None,
        "cohort_ids": cohort_ids_filter,
        "department_ids": request.department_ids,
        "attempt_type": attempt_type,
        "is_archived": is_archived,
    }


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------


@router.post("/get", response_model=LeaderboardResponse)
async def get_leaderboard(
    request: LeaderboardRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaderboardResponse:
    """Get leaderboard top sections (header metrics + accolades)."""
    tags = ["artifacts", "leaderboard"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    cache_key_val = cache_key(
        http_request.url.path,
        request.model_dump(mode="json"),
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return LeaderboardResponse.model_validate(cached["data"])

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        # --- Phase 0: Resolve common context (profile identity) ---
        async with pool.acquire() as c:
            common = await resolve_common_context(
                c, redis, profile_id=profile_id, bypass_cache=bypass_cache
            )
        if not common:
            raise HTTPException(status_code=401, detail="Profile not found")

        # --- Phase 1: Parse filters ---
        filters = _parse_filters(request)

        # --- Phase 2: Resolve leaderboard context ---
        async with pool.acquire() as c:
            ctx = await resolve_leaderboard_context(
                c,
                redis,
                target_profile_id=request.target_profile_id,
                cohort_ids=filters["cohort_ids"],
                department_ids=filters["department_ids"],
                attempt_type=filters["attempt_type"],
                is_archived=filters["is_archived"],
                date_from=filters["date_from"],
                date_to=filters["date_to"],
                bypass_cache=bypass_cache,
            )

        # --- Phase 3: Extract data ---
        attempt_chats = ctx.entries.get("attempt_chats", [])
        attempt_messages = ctx.entries.get("attempt_messages", [])

        profiles_rp = ctx.resources.get("profiles")
        profile_list = profiles_rp.selected if profiles_rp else []

        # --- Phase 4: Build sections ---
        sections = build_leaderboard_sections_v3(
            attempt_chats=attempt_chats,
            attempt_messages=attempt_messages,
        )

        # Build profile resources
        profile_resources = {
            str(item.profile_id): LeaderboardProfileResource(
                profile_id=str(item.profile_id),
                name=item.name,
                role=None,
            )
            for item in profile_list
            if item.profile_id is not None
        }

        resources = LeaderboardResources(
            profiles=profile_resources,
        )

        api_response = LeaderboardResponse(
            sections=sections,
            resources=resources,
        )

        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=tags,
            redis=redis,
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
            operation="artifacts_leaderboard_get",
            request=http_request,
        )

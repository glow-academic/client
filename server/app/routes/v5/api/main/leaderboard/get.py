"""Leaderboard GET endpoint — thin HTTP adapter over the canonical shared operation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.globals import get_pool
from app.infra.leaderboard.get import get_leaderboard_impl_cached
from app.routes.v5.api.main.leaderboard.types import LeaderboardRequest, LeaderboardResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/get", response_model=LeaderboardResponse)
async def get_leaderboard(
    request: LeaderboardRequest,
    http_request: Request,
    response: Response,
) -> LeaderboardResponse:
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(status_code=401, detail="Profile ID is required. Please sign in again.")

        response_data, cache_hit = await get_leaderboard_impl_cached(
            get_pool(),
            request,
            profile_id=profile_id,
            bypass_cache=http_request.headers.get("X-Bypass-Cache") == "1",
            cache_key_path=http_request.url.path,
        )
        response.headers["X-Cache-Tags"] = "artifacts,leaderboard"
        response.headers["X-Cache-Hit"] = "1" if cache_hit else "0"
        return response_data
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

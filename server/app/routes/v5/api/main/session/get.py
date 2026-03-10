"""Session GET endpoint — thin HTTP adapter over the canonical shared operation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.globals import get_pool
from app.infra.session.get import get_session_detail_impl_cached
from app.routes.v5.api.main.session.types import (
    GetSessionDetailRequest,
    GetSessionDetailResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/get", response_model=GetSessionDetailResponse)
async def get_session(
    request: GetSessionDetailRequest,
    http_request: Request,
    response: Response,
) -> GetSessionDetailResponse:
    """Get session detail with groups and timeline."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data, cache_hit = await get_session_detail_impl_cached(
            get_pool(),
            profile_id=profile_id,
            session_id=request.session_id,
            bypass_cache=http_request.headers.get("X-Bypass-Cache") == "1",
            cache_key_path=http_request.url.path,
        )

        response.headers["X-Cache-Tags"] = "artifacts,session"
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
            operation="artifacts_session_get",
            request=http_request,
        )

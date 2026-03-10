"""Invocation GET endpoint — thin HTTP adapter over the canonical shared operation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.infra.globals import get_pool, get_redis_client
from app.infra.invocation.get import get_invocation_impl
from app.routes.v5.api.main.invocation.types import GetSuiteRequest, GetSuiteResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/get", response_model=GetSuiteResponse)
async def invocation_get(
    request: GetSuiteRequest,
    http_request: Request,
) -> GetSuiteResponse:
    """Get hydrated resources for benchmark bundle customization."""
    try:
        profile_id = http_request.state.profile_id
        session_id = http_request.state.session_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        return await get_invocation_impl(
            get_pool(),
            get_redis_client(),
            profile_id=profile_id,
            session_id=session_id,
            test_id=request.test_id,
            draft_id=request.draft_id,
            descriptions_search=request.descriptions_search,
            bypass_cache=http_request.headers.get("X-Bypass-Cache") == "1",
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="invocation_get",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

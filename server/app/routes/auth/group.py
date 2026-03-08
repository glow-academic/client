"""Resolve group_id endpoint — thin route, delegates to infra."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from app.infra.auth.group import resolve_group as resolve_group_infra
from app.infra.globals import get_pool
from app.routes.auth.access import get_access_internal
from app.routes.auth.types import ResolveGroupApiRequest, ResolveGroupApiResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/group", response_model=ResolveGroupApiResponse)
async def resolve_group(
    request: ResolveGroupApiRequest,
    http_request: Request,
) -> ResolveGroupApiResponse:
    """Resolve a group_id from attempt, test, draft, or create fresh."""
    try:
        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database pool not available")

        # Common check: resolve profile context
        try:
            profile_id = http_request.state.profile_id
        except AttributeError:
            profile_id = None

        profiles_id: UUID | None = None
        if profile_id:
            async with pool.acquire() as conn:
                bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
                access = await get_access_internal(
                    conn,
                    profile_id=UUID(profile_id)
                    if isinstance(profile_id, str)
                    else profile_id,
                    bypass_cache=bypass_cache,
                )
                profiles_id = access.profiles_id

        # Delegate to infra
        async with pool.acquire() as conn:
            return await resolve_group_infra(
                conn=conn,
                profiles_id=profiles_id,
                attempt_id=request.attempt_id,
                test_id=request.test_id,
                draft_id=request.draft_id,
                artifact_type=request.artifact_type,
            )

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="resolve_group",
            request=http_request,
        )

"""Profile emulation endpoint — thin route, delegates to infra."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.auth.emulate import resolve_emulation
from app.infra.globals import get_db, get_redis_client
from app.sql.types import (
    CreateEmulationGrantApiRequest,
    CreateEmulationGrantApiResponse,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/emulate", response_model=CreateEmulationGrantApiResponse)
async def authorize_emulation(
    request: CreateEmulationGrantApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateEmulationGrantApiResponse:
    """Create emulation grant and return default-idp redirect URL."""
    try:
        requester_profile_id = getattr(http_request.state, "profile_id", None)
        if requester_profile_id is None:
            raise HTTPException(status_code=401, detail="Missing requester profile")

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        redis = get_redis_client()

        result = await resolve_emulation(
            conn,
            redis,
            requester_profile_id=requester_profile_id,
            target_profile_id=request.target_profile_id,
            ttl_minutes=request.ttl_minutes,
            return_url=request.return_url,
            bypass_cache=bypass_cache,
        )

        if not result.allowed:
            raise HTTPException(status_code=403, detail=result.reason or "Forbidden")

        api_response = CreateEmulationGrantApiResponse(
            allowed=result.allowed,
            reason=result.reason,
            actor_name=result.actor_name,
            grant_id=result.grant_id,
            expires_at=result.expires_at,
            target_profile_id=result.target_profile_id,
            redirect_url=result.redirect_url,
            logout_url=result.logout_url,
            emulate_page_url=result.emulate_page_url,
        )

        # Invalidate cache after mutation
        tags = ["profile"]
        await invalidate_tags(tags, redis=redis)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="authorize_emulation",
            request=http_request,
        )

"""Profile emulation endpoint — creates a grant for server-side identity swap."""

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.auth.emulate import resolve_emulation
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.profile.types import (
    EmulateProfileApiRequest,
    EmulateProfileApiResponse,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/emulate", response_model=EmulateProfileApiResponse)
async def emulate_profile(
    request: EmulateProfileApiRequest,
    http_request: Request,
    response: Response,
) -> EmulateProfileApiResponse:
    """Create emulation grant. Next request will resolve to target profile."""
    try:
        requester_profile_id = getattr(http_request.state, "profile_id", None)
        if requester_profile_id is None:
            raise HTTPException(status_code=401, detail="Missing requester profile")

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        redis = get_redis_client()
        pool = get_pool()

        result = await resolve_emulation(
            pool,
            redis,
            requester_profile_id=requester_profile_id,
            target_profile_id=request.target_profile_id,
            ttl_minutes=request.ttl_minutes or 120,
            bypass_cache=bypass_cache,
        )

        if not result.allowed:
            raise HTTPException(status_code=403, detail=result.reason or "Forbidden")

        # Invalidate cache after mutation
        tags = ["profile"]
        await invalidate_tags(tags, redis=redis)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return EmulateProfileApiResponse(
            allowed=result.allowed,
            reason=result.reason,
            grant_id=result.grant_id,
            expires_at=result.expires_at,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="emulate_profile",
            request=http_request,
        )

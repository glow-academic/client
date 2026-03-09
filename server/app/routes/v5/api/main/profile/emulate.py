"""Profile emulation endpoints — emulate (go deeper) and unemulate (peel one layer)."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.auth.emulate import resolve_emulation, resolve_unemulation
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.profile.types import (
    EmulateProfileApiRequest,
    EmulateProfileApiResponse,
    UnemulateProfileApiResponse,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


def _get_identity_ids(http_request: Request) -> tuple[UUID | None, UUID | None]:
    """Extract effective profile_id and actor_profile_id from request."""
    raw = getattr(http_request.state, "profile_id", None)
    profile_id = UUID(raw) if raw else None
    identity = getattr(http_request.state, "identity", None)
    actor_profile_id = getattr(identity, "actor_profile_id", None) if identity else None
    return profile_id, actor_profile_id


@router.post("/emulate", response_model=EmulateProfileApiResponse)
async def emulate_profile(
    request: EmulateProfileApiRequest,
    http_request: Request,
    response: Response,
) -> EmulateProfileApiResponse:
    """Create emulation grant. Next request will resolve to target profile."""
    try:
        profile_id, actor_profile_id = _get_identity_ids(http_request)
        if profile_id is None:
            raise HTTPException(status_code=401, detail="Missing requester profile")

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        redis = get_redis_client()
        pool = get_pool()

        result = await resolve_emulation(
            pool,
            redis,
            requester_profile_id=profile_id,
            target_profile_id=request.target_profile_id,
            ttl_minutes=request.ttl_minutes or 120,
            bypass_cache=bypass_cache,
            actor_profile_id=actor_profile_id,
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


@router.post("/unemulate", response_model=UnemulateProfileApiResponse)
async def unemulate_profile(
    http_request: Request,
    response: Response,
) -> UnemulateProfileApiResponse:
    """Exit innermost emulation layer. Next request resolves one layer less."""
    try:
        profile_id, actor_profile_id = _get_identity_ids(http_request)
        if profile_id is None:
            raise HTTPException(status_code=401, detail="Missing profile")

        # actor_profile_id is the real JWT profile; if not emulating, it's None
        origin = actor_profile_id or profile_id
        pool = get_pool()

        result = await resolve_unemulation(pool, actor_profile_id=origin)

        if not result.ok:
            raise HTTPException(
                status_code=400, detail=result.reason or "Cannot exit emulation"
            )

        # Invalidate cache after mutation
        redis = get_redis_client()
        tags = ["profile"]
        await invalidate_tags(tags, redis=redis)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return UnemulateProfileApiResponse(ok=result.ok, reason=result.reason)
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="unemulate_profile",
            request=http_request,
        )

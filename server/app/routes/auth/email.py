"""Profile by email endpoint — thin route, delegates to infra."""

from fastapi import APIRouter, HTTPException, Request

from app.infra.auth.email import resolve_profile_by_email
from app.infra.globals import get_pool, get_redis_client
from app.routes.shared_types import (
    GetProfileByEmailApiRequest,
    GetProfileByEmailApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/email", response_model=GetProfileByEmailApiResponse)
async def get_profile_by_email(
    request: GetProfileByEmailApiRequest,
    http_request: Request,
) -> GetProfileByEmailApiResponse:
    """Get profile by email (for auth operations)."""
    try:
        profile_id = getattr(http_request.state, "profile_id", None)
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        redis = get_redis_client()

        pool = get_pool()
        result = await resolve_profile_by_email(
            pool,
            redis,
            email=request.email,
            actor_profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

        if not result:
            raise HTTPException(status_code=404, detail="Profile not found")

        return GetProfileByEmailApiResponse(
            profile_id=result.profile_id,
            name=result.name,
            emails=result.emails,
            primary_email=result.primary_email,
            role=result.role,
            active=result.active,
            req_per_day=result.req_per_day,
            primary_department_id=result.primary_department_id,
            actor_name=result.actor_name,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_profile_by_email",
            request=http_request,
        )

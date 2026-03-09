"""Profile create or update endpoint — thin route, delegates to infra."""

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.auth.upsert import resolve_profile_upsert
from app.infra.globals import get_pool, get_redis_client
from app.routes.shared_types import (
    CreateOrUpdateProfileApiRequest,
    CreateOrUpdateProfileApiResponse,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/upsert", response_model=CreateOrUpdateProfileApiResponse)
async def create_or_update_profile(
    request: CreateOrUpdateProfileApiRequest,
    http_request: Request,
    response: Response,
) -> CreateOrUpdateProfileApiResponse:
    """Create or update a profile based on email."""
    try:
        if not request.emails or len(request.emails) == 0:
            raise HTTPException(
                status_code=400, detail="At least one email is required"
            )

        primary_index = (
            request.primary_email_index
            if request.primary_email_index is not None
            else 0
        )
        if primary_index < 0 or primary_index >= len(request.emails):
            raise HTTPException(status_code=400, detail="Invalid primary_email_index")

        current_profile_id = http_request.state.profile_id
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        redis = get_redis_client()

        pool = get_pool()
        result = await resolve_profile_upsert(
            pool,
            redis,
            name=request.name,
            emails=request.emails,
            role=request.role,
            primary_email_index=primary_index,
            active=request.active if request.active is not None else True,
            department_ids=request.department_ids,
            profile_id_new=request.profile_id_new,
            current_profile_id=current_profile_id,
            bypass_cache=bypass_cache,
        )

        # Invalidate cache after mutation
        tags = ["profile"]
        await invalidate_tags(tags, redis=redis)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return CreateOrUpdateProfileApiResponse(
            profile_id=result.profile_id,
            created=result.created,
            session_id=result.session_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_or_update_profile",
            request=http_request,
        )

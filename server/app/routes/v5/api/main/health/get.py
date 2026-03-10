"""Health artifact endpoint — thin HTTP adapter over the canonical shared operation."""

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.globals import get_pool, get_redis_client
from app.infra.health.get import get_health_impl
from app.routes.v5.api.main.health.types import HealthRequest, HealthResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/get", response_model=HealthResponse)
async def get_health(
    request: HealthRequest,
    http_request: Request,
    response: Response,
) -> HealthResponse:
    """Get health artifact data."""
    tags = ["artifacts", "health"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        result = await get_health_impl(
            get_pool(),
            profile_id=profile_id,
            redis=get_redis_client(),
            service=request.service,
            date_from=request.date_from,
            date_to=request.date_to,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_health_get",
            request=http_request,
        )

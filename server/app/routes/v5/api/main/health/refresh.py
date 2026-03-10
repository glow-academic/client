"""Health refresh endpoint — composable infra architecture."""

from fastapi import APIRouter, Request, Response

from app.infra.globals import get_pool, get_redis_client
from app.infra.health.refresh import refresh_health_impl
from app.infra.refresh.types import RefreshResponse

router = APIRouter()


@router.post("/refresh", response_model=RefreshResponse)
async def health_refresh(
    http_request: Request,
    response: Response,
) -> RefreshResponse:
    """Refresh health materialized views and invalidate caches."""
    pool = get_pool()
    profile_id = http_request.state.profile_id

    result = await refresh_health_impl(
        pool,
        get_redis_client(),
        profile_id=profile_id,
    )

    response.headers["X-Invalidate-Tags"] = ",".join(result.invalidated_tags)

    return result

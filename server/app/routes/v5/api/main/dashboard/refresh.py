"""Dashboard refresh endpoint — composable infra architecture."""

from fastapi import APIRouter, Request, Response

from app.infra.dashboard_refresh import refresh_dashboard_client
from app.infra.globals import get_pool, get_redis_client
from app.infra.refresh.types import RefreshResponse

router = APIRouter()


@router.post("/refresh", response_model=RefreshResponse)
async def dashboard_refresh(
    http_request: Request,
    response: Response,
) -> RefreshResponse:
    """Refresh dashboard caches (no materialized views)."""
    profile_id = http_request.state.profile_id
    pool = get_pool()

    result = await refresh_dashboard_client(
        pool,
        get_redis_client(),
        profile_id=profile_id,
    )

    response.headers["X-Invalidate-Tags"] = ",".join(result.invalidated_tags)

    return result

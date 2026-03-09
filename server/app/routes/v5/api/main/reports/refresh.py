"""Reports refresh endpoint — composable infra architecture."""

from fastapi import APIRouter, Request, Response

from app.infra.globals import get_pool, get_redis_client
from app.infra.refresh.types import RefreshResponse
from app.infra.reports_refresh import refresh_reports_client

router = APIRouter()


@router.post("/refresh", response_model=RefreshResponse)
async def reports_refresh(
    http_request: Request,
    response: Response,
) -> RefreshResponse:
    """Refresh reports caches."""
    pool = get_pool()
    redis = get_redis_client()
    profile_id = http_request.state.profile_id

    result = await refresh_reports_client(
        pool,
        redis,
        profile_id=profile_id,
    )

    response.headers["X-Invalidate-Tags"] = ",".join(result.invalidated_tags)

    return result

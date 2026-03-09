"""Group refresh endpoint — composable infra architecture."""

from fastapi import APIRouter, Request, Response

from app.infra.globals import get_pool, get_redis_client
from app.infra.group_refresh import refresh_group_client
from app.infra.refresh.types import RefreshResponse

router = APIRouter()


@router.post("/refresh", response_model=RefreshResponse)
async def group_refresh(
    http_request: Request,
    response: Response,
) -> RefreshResponse:
    """Refresh group materialized views and invalidate caches."""
    pool = get_pool()
    profile_id = http_request.state.profile_id

    result = await refresh_group_client(
        pool,
        get_redis_client(),
        profile_id=profile_id,
    )

    response.headers["X-Invalidate-Tags"] = ",".join(result.invalidated_tags)

    return result

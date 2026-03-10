"""Session refresh endpoint — composable infra architecture."""

from fastapi import APIRouter, Request, Response

from app.infra.globals import get_pool, get_redis_client
from app.infra.refresh.types import RefreshResponse
from app.infra.session.refresh import refresh_session_impl

router = APIRouter()


@router.post("/refresh", response_model=RefreshResponse)
async def session_refresh(
    http_request: Request,
    response: Response,
) -> RefreshResponse:
    """Refresh session materialized views and invalidate caches."""
    profile_id = http_request.state.profile_id
    pool = get_pool()

    result = await refresh_session_impl(
        pool,
        get_redis_client(),
        profile_id=profile_id,
    )

    response.headers["X-Invalidate-Tags"] = ",".join(result.invalidated_tags)

    return result

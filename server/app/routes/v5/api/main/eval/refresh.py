"""Eval refresh endpoint — composable infra architecture."""

from fastapi import APIRouter, Request, Response

from app.infra.eval.refresh import refresh_eval_impl
from app.infra.globals import get_pool, get_redis_client
from app.infra.refresh.types import RefreshResponse

router = APIRouter()


@router.post("/refresh", response_model=RefreshResponse)
async def eval_refresh(
    http_request: Request,
    response: Response,
) -> RefreshResponse:
    """Refresh eval materialized views and invalidate caches."""
    profile_id = http_request.state.profile_id

    pool = get_pool()
    redis = get_redis_client()

    result = await refresh_eval_impl(
        pool,
        redis,
        profile_id=profile_id,
    )

    response.headers["X-Invalidate-Tags"] = ",".join(result.invalidated_tags)

    return result

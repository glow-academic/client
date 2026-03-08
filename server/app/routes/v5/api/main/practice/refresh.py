"""Practice refresh endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis
from app.infra.practice_refresh import refresh_practice_client
from app.infra.refresh.types import RefreshResponse

router = APIRouter()


@router.post("/refresh", response_model=RefreshResponse)
async def practice_refresh(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> RefreshResponse:
    """Refresh practice materialized views and invalidate caches."""
    profile_id = http_request.state.profile_id

    result = await refresh_practice_client(
        conn,
        redis,
        profile_id=profile_id,
    )

    response.headers["X-Invalidate-Tags"] = ",".join(result.invalidated_tags)

    return result

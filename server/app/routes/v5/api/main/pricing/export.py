"""Pricing export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis
from app.infra.pricing_export import export_pricing_client
from app.routes.v5.api.main.pricing.types import ExportPricingApiResponse

router = APIRouter()


@router.post("/export", response_model=ExportPricingApiResponse)
async def export_pricing(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportPricingApiResponse:
    """Export all pricing data as a clean, denormalized ZIP."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_pricing_client(
        conn, redis, profile_id=profile_id, session_id=session_id,
    )

"""Tool docs endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.docs.types import ComposedDocsResponse
from app.infra.globals import get_db, get_redis_client
from app.infra.tool_docs import docs_tool_client

router = APIRouter()


@router.post("/docs", response_model=ComposedDocsResponse)
async def get_tool_docs_endpoint(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis_client)],
) -> ComposedDocsResponse:
    """Get composed documentation for the tool artifact."""
    profile_id = http_request.state.profile_id

    return await docs_tool_client(
        conn,
        redis,
        profile_id=profile_id,
    )

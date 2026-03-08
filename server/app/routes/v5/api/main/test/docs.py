"""Test docs endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.docs.types import ComposedDocsResponse
from app.infra.globals import get_db, get_redis_client
from app.infra.test_docs import docs_test_client
from app.infra.docs_helper import DocsApiRequest

router = APIRouter()


@router.post("/docs", response_model=ComposedDocsResponse)
async def get_test_docs_endpoint(
    body: DocsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis_client)],
) -> ComposedDocsResponse:
    """Get composed documentation for the test analytics."""
    profile_id = http_request.state.profile_id

    return await docs_test_client(
        conn,
        redis,
        profile_id=profile_id,
        entity_id=body.entity_id,
    )

"""Profile docs endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.docs.types import ComposedDocsResponse
from app.infra.globals import get_pool, get_redis_client
from app.infra.profile_docs import docs_profile_client
from app.infra.docs_helper import DocsApiRequest

router = APIRouter()


@router.post("/docs", response_model=ComposedDocsResponse)
async def get_profile_docs_endpoint(
    body: DocsApiRequest,
    http_request: Request,
    response: Response,
) -> ComposedDocsResponse:
    """Get composed documentation for the profile artifact."""
    profile_id = http_request.state.profile_id
    pool = get_pool()
    redis = get_redis_client()

    return await docs_profile_client(
        pool,
        redis,
        profile_id=profile_id,
        entity_id=body.entity_id,
    )

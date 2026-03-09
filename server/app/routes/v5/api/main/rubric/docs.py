"""Rubric docs endpoint — composable infra architecture."""

from fastapi import APIRouter, Request, Response

from app.infra.docs.types import ComposedDocsResponse
from app.infra.docs_helper import DocsApiRequest
from app.infra.globals import get_pool, get_redis_client
from app.infra.rubric_docs import docs_rubric_client

router = APIRouter()


@router.post("/docs", response_model=ComposedDocsResponse)
async def get_rubric_docs_endpoint(
    body: DocsApiRequest,
    http_request: Request,
    response: Response,
) -> ComposedDocsResponse:
    """Get composed documentation for the rubric artifact."""
    profile_id = http_request.state.profile_id
    pool = get_pool()
    redis = get_redis_client()

    return await docs_rubric_client(
        pool,
        redis,
        profile_id=profile_id,
        entity_id=body.entity_id,
    )

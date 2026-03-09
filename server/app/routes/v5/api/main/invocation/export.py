"""Invocation export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_pool, get_redis_client
from app.infra.invocation_export import export_invocation_client
from app.routes.v5.api.main.invocation.types import ExportInvocationApiResponse

router = APIRouter()


class ExportInvocationApiRequest(BaseModel):
    """Request model for invocation export."""

    test_id: UUID
    group_id: UUID
    invocation_entry_id: UUID | None = None
    draft_id: UUID | None = None


@router.post("/export", response_model=ExportInvocationApiResponse)
async def export_invocation(
    body: ExportInvocationApiRequest,
    http_request: Request,
    response: Response,
) -> ExportInvocationApiResponse:
    """Export a single invocation as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    pool = get_pool()
    redis = get_redis_client()

    return await export_invocation_client(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        test_id=body.test_id,
        group_id=body.group_id,
        invocation_entry_id=body.invocation_entry_id,
        draft_id=body.draft_id,
    )

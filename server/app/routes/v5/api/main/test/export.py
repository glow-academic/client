"""Test export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_pool, get_redis_client
from app.infra.test_export import export_test_client
from app.routes.v5.api.main.test.types import ExportTestApiResponse

router = APIRouter()


class ExportTestApiRequest(BaseModel):
    test_id: UUID


@router.post("/export", response_model=ExportTestApiResponse)
async def export_test(
    body: ExportTestApiRequest,
    http_request: Request,
    response: Response,
) -> ExportTestApiResponse:
    """Export test data as a clean, denormalized ZIP."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    pool = get_pool()

    return await export_test_client(
        pool,
        get_redis_client(),
        profile_id=profile_id,
        session_id=session_id,
        test_id=body.test_id,
    )

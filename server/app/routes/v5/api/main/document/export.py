"""Document export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.infra.document.export import export_document_impl
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.document.types import ExportDocumentApiResponse

router = APIRouter()


class ExportDocumentApiRequest(BaseModel):
    """Request model for document export."""

    document_id: UUID | None = None


@router.post("/export", response_model=ExportDocumentApiResponse)
async def export_documents(
    body: ExportDocumentApiRequest,
    http_request: Request,
) -> ExportDocumentApiResponse:
    """Export all documents as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    pool = get_pool()
    redis = get_redis_client()

    return await export_document_impl(
        pool,
        redis,
        profile_id=profile_id,
        document_id=body.document_id,
    )

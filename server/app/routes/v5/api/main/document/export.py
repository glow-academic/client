"""Document export endpoint — composable infra architecture."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.document_export import export_document_client
from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.document.types import ExportDocumentApiResponse

router = APIRouter()


class ExportDocumentApiRequest(BaseModel):
    """Request model for document export."""

    document_id: UUID | None = None


@router.post("/export", response_model=ExportDocumentApiResponse)
async def export_documents(
    body: ExportDocumentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis_client)],
) -> ExportDocumentApiResponse:
    """Export all documents as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_document_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        document_id=body.document_id,
    )

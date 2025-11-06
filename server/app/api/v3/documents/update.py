"""Document update endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class UpdateDocumentRequest(BaseModel):
    """Request for updating a document."""

    documentId: str
    type: str
    department_id: str | None = None
    parameter_item_ids: list[str] = []


class UpdateDocumentResponse(BaseModel):
    """Response for updating a document."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateDocumentResponse)
async def update_document(
    request: UpdateDocumentRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateDocumentResponse:
    """Update a document."""
    tags = ["documents"]  # From router tags
    
    try:
        async with transaction(conn):
            # Update document with department links and parameter items in a single transaction
            sql = load_sql("sql/v3/documents/update_document_complete.sql")
            # Ensure parameter_item_ids is always an array (empty if None)
            param_item_ids = request.parameter_item_ids or []
            await conn.execute(
                sql,
                uuid.UUID(request.documentId),
                request.type,
                uuid.UUID(request.department_id) if request.department_id else None,
                param_item_ids,
            )

        result = UpdateDocumentResponse(
            success=True,
            message="Document updated successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


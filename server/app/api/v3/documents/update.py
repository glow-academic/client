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
            # Update document
            sql = load_sql("sql/v3/documents/update_document.sql")
            await conn.execute(sql, uuid.UUID(request.documentId), request.type, uuid.UUID(request.department_id) if request.department_id else None)

            # Update parameter items (delete old, insert new)
            delete_sql = load_sql("sql/v3/documents/delete_document_parameter_items.sql")
            await conn.execute(delete_sql, uuid.UUID(request.documentId))

            if request.parameter_item_ids:
                insert_sql = load_sql("sql/v3/documents/insert_document_parameter_item.sql")
                for param_item_id in request.parameter_item_ids:
                    await conn.execute(insert_sql, uuid.UUID(request.documentId), uuid.UUID(param_item_id))

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


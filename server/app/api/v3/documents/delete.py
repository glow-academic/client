"""Document delete endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql


class DeleteDocumentRequest(BaseModel):
    """Request to delete a document."""

    documentId: str


class DeleteDocumentResponse(BaseModel):
    """Response from delete operation."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteDocumentResponse)
async def delete_document(
    request: DeleteDocumentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteDocumentResponse:
    """Delete a document."""
    try:
        sql = load_sql("sql/v3/documents/delete_document.sql")
        await conn.execute(sql, uuid.UUID(request.documentId))

        return DeleteDocumentResponse(
            success=True,
            message="Document deleted successfully",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


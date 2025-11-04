"""Document bulk delete endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql


class BulkDeleteDocumentsRequest(BaseModel):
    """Request to bulk delete documents."""

    documentIds: list[str]


class BulkDeleteDocumentsResponse(BaseModel):
    """Response from bulk delete operation."""

    success: bool
    message: str


router = APIRouter()


@router.post("/bulk-delete", response_model=BulkDeleteDocumentsResponse)
async def bulk_delete_documents(
    request: BulkDeleteDocumentsRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteDocumentsResponse:
    """Bulk delete documents."""
    try:
        sql = load_sql("sql/v3/documents/bulk_delete_documents.sql")
        await conn.execute(sql, [uuid.UUID(did) for did in request.documentIds])

        return BulkDeleteDocumentsResponse(
            success=True,
            message=f"Deleted {len(request.documentIds)} document(s) successfully",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


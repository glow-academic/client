"""Document bulk delete endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import invalidate_tags
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
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteDocumentsResponse:
    """Bulk delete documents."""
    tags = ["documents"]  # From router tags
    
    try:
        sql = load_sql("sql/v3/documents/bulk_delete_documents.sql")
        await conn.execute(sql, [uuid.UUID(did) for did in request.documentIds])

        result = BulkDeleteDocumentsResponse(
            success=True,
            message=f"Deleted {len(request.documentIds)} document(s) successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


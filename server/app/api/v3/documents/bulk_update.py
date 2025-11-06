"""Document bulk update endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class BulkUpdateDocumentsRequest(BaseModel):
    """Request to bulk update documents."""

    documentIds: list[str]
    type: str
    department_id: str | None = None
    parameter_item_ids: list[str] = []


class BulkUpdateDocumentsResponse(BaseModel):
    """Response from bulk update operation."""

    success: bool
    message: str


router = APIRouter()


@router.post("/bulk-update", response_model=BulkUpdateDocumentsResponse)
async def bulk_update_documents(
    request: BulkUpdateDocumentsRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkUpdateDocumentsResponse:
    """Bulk update documents."""
    tags = ["documents"]  # From router tags
    
    try:
        async with transaction(conn):
            # Bulk update documents with department links and parameter items in a single transaction
            sql = load_sql("sql/v3/documents/bulk_update_documents_complete.sql")
            # Ensure parameter_item_ids is always an array (empty if None)
            param_item_ids = request.parameter_item_ids or []
            await conn.execute(
                sql,
                [uuid.UUID(did) for did in request.documentIds],
                request.type,
                uuid.UUID(request.department_id) if request.department_id else None,
                param_item_ids,
            )

        result = BulkUpdateDocumentsResponse(
            success=True,
            message=f"Updated {len(request.documentIds)} document(s) successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


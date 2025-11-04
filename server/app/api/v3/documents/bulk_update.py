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
            # Bulk update documents
            sql = load_sql("sql/v3/documents/bulk_update_documents.sql")
            await conn.execute(
                sql,
                [uuid.UUID(did) for did in request.documentIds],
                request.type,
                uuid.UUID(request.department_id) if request.department_id else None,
            )

            # Delete old parameter items for all documents
            delete_sql = load_sql("sql/v3/documents/delete_document_parameter_items_bulk.sql")
            await conn.execute(delete_sql, [uuid.UUID(did) for did in request.documentIds])

            # Insert new parameter items for all documents
            if request.parameter_item_ids:
                insert_sql = load_sql("sql/v3/documents/insert_document_parameter_item.sql")
                for doc_id in request.documentIds:
                    for param_item_id in request.parameter_item_ids:
                        await conn.execute(
                            insert_sql,
                            uuid.UUID(doc_id),
                            uuid.UUID(param_item_id),
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


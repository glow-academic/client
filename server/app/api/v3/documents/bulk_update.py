"""Document bulk update endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.error_handler import handle_route_error
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkUpdateDocumentsResponse:
    """Bulk update documents."""
    tags = ["documents"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        async with transaction(conn):
            # Bulk update documents with department links and parameter items in a single transaction
            sql_query = load_sql("sql/v3/documents/bulk_update_documents_complete.sql")
            # Ensure parameter_item_ids is always an array (empty if None)
            param_item_ids = request.parameter_item_ids or []
            sql_params = (
                [uuid.UUID(did) for did in request.documentIds],
                request.type,
                uuid.UUID(request.department_id) if request.department_id else None,
                param_item_ids,
            )
            await conn.execute(
                sql_query,
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
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="bulk_update_documents",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


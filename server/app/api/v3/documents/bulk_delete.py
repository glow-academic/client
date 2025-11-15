"""Document bulk delete endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.error_handler import handle_route_error
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteDocumentsResponse:
    """Bulk delete documents."""
    tags = ["documents"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/documents/bulk_delete_documents.sql")
        sql_params = ([uuid.UUID(did) for did in request.documentIds],)
        await conn.execute(sql_query, [uuid.UUID(did) for did in request.documentIds])

        result = BulkDeleteDocumentsResponse(
            success=True,
            message=f"Deleted {len(request.documentIds)} document(s) successfully",
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
            operation="bulk_delete_documents",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

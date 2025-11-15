"""Document delete endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.invalidate_tags import invalidate_tags
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteDocumentResponse:
    """Delete a document."""
    tags = ["documents"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/documents/delete_document.sql")
        sql_params = (uuid.UUID(request.documentId),)
        await conn.execute(sql_query, uuid.UUID(request.documentId))

        result = DeleteDocumentResponse(
            success=True,
            message="Document deleted successfully",
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
            operation="delete_document",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

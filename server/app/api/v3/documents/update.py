"""Document update endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateDocumentResponse:
    """Update a document."""
    tags = ["documents"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Update document with department links and parameter items in a single transaction
            sql_query = load_sql("sql/v3/documents/update_document_complete.sql")
            # Ensure parameter_item_ids is always an array (empty if None)
            param_item_ids = request.parameter_item_ids or []
            sql_params = (
                uuid.UUID(request.documentId),
                request.type,
                uuid.UUID(request.department_id) if request.department_id else None,
                param_item_ids,
            )
            await conn.execute(
                sql_query,
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
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_document",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

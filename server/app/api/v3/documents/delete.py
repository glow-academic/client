"""Document delete endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


class DeleteDocumentRequest(BaseModel):
    """Request to delete a document."""

    documentId: str


class DeleteDocumentResponse(BaseModel):
    """Response from delete operation."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteDocumentResponse,
    dependencies=[
        audit_activity(
            "document.deleted",
            "{{ actor.name }} deleted document '{{ document.name }}'",
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("app/sql/v3/documents/delete_document.sql")
        sql_params = (uuid.UUID(request.documentId), uuid.UUID(profile_id))
        result_row = await conn.fetchrow(
            sql_query, uuid.UUID(request.documentId), uuid.UUID(profile_id)
        )

        if result_row:
            document_name = result_row.get("document_name", "Unknown")
            actor_name = result_row.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    document={"name": document_name, "id": request.documentId},
                )

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

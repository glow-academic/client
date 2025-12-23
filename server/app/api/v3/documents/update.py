"""Document update endpoint - v3 API."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class UpdateDocumentRequest(BaseModel):
    """Request for updating a document."""

    documentId: str
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    template: bool | None = None  # Enable/disable template mode
    department_id: str | None = None
    field_ids: list[str] = []
    classify_agent_id: str | None = None
    document_agent_id: str | None = None
    templateUploadId: str | None = None  # Template HTML upload
    templateArgs: dict[str, Any] | None = None  # Template schema JSON


class UpdateDocumentResponse(BaseModel):
    """Response for updating a document."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateDocumentResponse,
    dependencies=[
        audit_activity(
            "document.updated",
            "{{ actor.name }} updated document '{{ document.name }}'",
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with transaction(conn):
            # Prepare template args (schema) as JSONB
            template_args_jsonb = None
            if request.templateArgs is not None:
                template_args_jsonb = json.dumps(request.templateArgs)

            # Update document with department links and parameter items in a single transaction
            sql_query = load_sql("sql/v3/documents/update_document_complete.sql")
            # Ensure field_ids is always an array (empty if None)
            field_ids_list = request.field_ids or []
            sql_params = (
                uuid.UUID(request.documentId),
                request.name,
                request.description,
                request.active,
                request.template,
                uuid.UUID(request.department_id) if request.department_id else None,
                field_ids_list,
                uuid.UUID(request.classify_agent_id)
                if request.classify_agent_id
                else None,
                uuid.UUID(request.document_agent_id)
                if request.document_agent_id
                else None,
                uuid.UUID(request.templateUploadId)
                if request.templateUploadId
                else None,
                template_args_jsonb,
                uuid.UUID(profile_id),
            )
            result_row = await conn.fetchrow(sql_query, *sql_params)

            if result_row:
                document_name = result_row.get(
                    "document_name", request.name or "Unknown"
                )
                actor_name = result_row.get("actor_name")

                # Set audit context with data from SQL query
                if actor_name:
                    audit_set(
                        http_request,
                        actor={"name": actor_name, "id": profile_id},
                        document={"name": document_name, "id": request.documentId},
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

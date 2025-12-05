"""Document create endpoint - v3 API following DHH principles."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql

router = APIRouter()


# Inline request/response schemas
class CreateDocumentRequest(BaseModel):
    """Request to create document."""

    name: str
    description: str | None = None
    uploadId: str | None = None  # Regular document upload
    departmentIds: list[str] | None = None
    parameterItemIds: list[str] | None = None
    profileId: str
    templateUploadId: str | None = None  # Template HTML upload
    templateArgs: dict[str, Any] | None = None  # Template schema JSON
    instructions: str | None = None  # Template instructions


class CreateDocumentResponse(BaseModel):
    """Response from create document."""

    success: bool
    message: str
    documentId: str | None = None


@router.post("/create", response_model=CreateDocumentResponse)
async def create_document(
    request_body: CreateDocumentRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateDocumentResponse:
    """Create a new document."""
    tags = ["documents"]
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        document_id = uuid.uuid4()

        dept_uuids = (
            [uuid.UUID(d) for d in request_body.departmentIds]
            if request_body.departmentIds
            else []
        )
        param_item_uuids = (
            [uuid.UUID(p) for p in request_body.parameterItemIds]
            if request_body.parameterItemIds
            else []
        )

        # Prepare template args (schema) as JSONB
        template_args_jsonb = None
        if request_body.templateArgs:
            template_args_jsonb = json.dumps(request_body.templateArgs)

        sql_query = load_sql("sql/v3/documents/insert_document_complete.sql")
        sql_params = (
            document_id,
            request_body.name,
            request_body.description or '',
            uuid.UUID(request_body.uploadId) if request_body.uploadId else None,
            dept_uuids,
            param_item_uuids,
            uuid.UUID(request_body.templateUploadId) if request_body.templateUploadId else None,
            template_args_jsonb,
            request_body.instructions or '',
        )

        await conn.execute(
            sql_query,
            document_id,
            request_body.name,
            request_body.description or '',
            uuid.UUID(request_body.uploadId) if request_body.uploadId else None,
            dept_uuids,
            param_item_uuids,
            uuid.UUID(request_body.templateUploadId) if request_body.templateUploadId else None,
            template_args_jsonb,
            request_body.instructions or '',
        )

        result_data = CreateDocumentResponse(
            success=True,
            message="Document created successfully",
            documentId=str(document_id),
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="create_document",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )


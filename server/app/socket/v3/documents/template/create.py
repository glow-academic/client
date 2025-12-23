"""Handler for document_template_create internal event - creates template records."""

import json
import os
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import UPLOAD_FOLDER, get_internal_sio, get_pool, sio
from app.socket.v3.documents.generate import (
    DocumentTemplateGenerationCompletePayload,
    document_template_generation_complete)
from utils.cache.invalidate_tags import invalidate_tags
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class CreateDocumentTemplatePayload(BaseModel):
    """Request to create a document template."""

    document_id: str | None = None
    document_name: str | None = None
    template_html: str
    template_schema: dict[str, Any]
    run_id: str
    sid: str | None = None  # WebSocket session ID for error handling
    room: str | None = None  # WebSocket room for emitting events


async def _document_template_create_impl(
    document_id: uuid.UUID | None,
    document_name: str | None,
    template_html: str,
    template_schema: dict[str, Any],
    run_id: uuid.UUID,
    sid: str | None = None,
    room: str | None = None,
) -> dict[str, Any] | None:
    """Internal implementation for creating a document template."""
    pool = get_pool()
    if not pool:
        logger.error("Database connection pool not available for template creation")
        return None

    async with pool.acquire() as conn:
        try:
            # Save template HTML to file and create upload record
            upload_uuid = uuid.uuid4()
            file_path = f"{upload_uuid}.html"
            full_path = os.path.join(UPLOAD_FOLDER, file_path)

            # Ensure uploads directory exists
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)

            # Write template HTML to file
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(template_html)

            # Create upload record
            sql_insert_upload = load_sql("app/sql/v3/uploads/insert_upload.sql")
            upload_id_result = await conn.fetchrow(
                sql_insert_upload,
                file_path,
                "text/html",
                len(template_html.encode("utf-8")),
            )
            upload_id = upload_id_result["id"]

            template_mapping: dict[str, Any] | None = None

            # If documentId is provided, create template and link to document and run
            if document_id:
                template_schema_jsonb = json.dumps(template_schema)
                template_name = f"Template for {document_name or 'Document'}"

                # Create template and link to document and run
                sql_create_template = load_sql(
                    "app/sql/v3/documents/create_template_and_link.sql"
                )
                template_result = await conn.fetchrow(
                    sql_create_template,
                    str(document_id),
                    str(uuid.UUID(upload_id)),
                    template_name,
                    template_schema_jsonb,
                    True,  # active = true
                    str(run_id),  # run_id
                )

                if template_result:
                    template_id = template_result["template_id"]
                    logger.info(
                        f"Created template {template_id} and linked to document {document_id} and run {run_id}"
                    )

                # Fetch updated template_mapping
                sql_get_template_mapping = load_sql(
                    "app/sql/v3/documents/get_template_mapping.sql"
                )
                mapping_row = await conn.fetchrow(
                    sql_get_template_mapping, str(document_id)
                )
                if mapping_row and mapping_row.get("template_mapping"):
                    mapping_data = mapping_row["template_mapping"]
                    if isinstance(mapping_data, str):
                        try:
                            template_mapping = json.loads(mapping_data)
                        except json.JSONDecodeError:
                            logger.warning(
                                f"Failed to parse template_mapping JSON: {mapping_data}"
                            )
                            template_mapping = {}
                    elif isinstance(mapping_data, dict):
                        template_mapping = mapping_data
                    else:
                        template_mapping = {}

                # Invalidate documents cache
                await invalidate_tags(["documents"])
                logger.info(
                    f"Template saved to document {document_id} with upload_id {upload_id}"
                )

            # Emit completion event if room provided
            if room:
                await document_template_generation_complete(
                    DocumentTemplateGenerationCompletePayload(
                        success=True,
                        message="Document template created successfully",
                        template_html=template_html,
                        template_schema=template_schema,
                        upload_id=upload_id,
                        template_mapping=template_mapping,
                        trace_id=None,
                    ),
                    room=room,
                )

            return {
                "upload_id": upload_id,
                "template_mapping": template_mapping,
            }

        except Exception as e:
            logger.error(
                f"Error creating document template: {e}", exc_info=True
            )
            return None


@internal_sio.on("document_template_create")
async def document_template_create_internal(data: dict[str, Any]) -> None:
    """Handle document_template_create event from internal bus."""
    try:
        validated = CreateDocumentTemplatePayload(**data)
        document_id = (
            uuid.UUID(validated.document_id)
            if validated.document_id
            else None
        )
        await _document_template_create_impl(
            document_id,
            validated.document_name,
            validated.template_html,
            validated.template_schema,
            uuid.UUID(validated.run_id),
            validated.sid,
            validated.room,
        )
    except ValidationError as e:
        logger.error(f"Validation error in document_template_create: {e}")
    except Exception as e:
        logger.error(
            f"Error in document_template_create_internal: {e}", exc_info=True
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/create", response_model=dict[str, bool])
async def document_template_create_api(
    request: CreateDocumentTemplatePayload,
) -> dict[str, bool]:
    """Internal event: Create a document template."""
    return {"success": True}


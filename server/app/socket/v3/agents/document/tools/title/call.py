"""Handler for document_tool_title WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.sql_helper import load_sql

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.openapi_helpers import register_client_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class DocumentTitleToolPayload(BaseModel):
    """Request to create/update title from document generation tool."""

    trace_id: str
    title: str
    document_id: str | None = None


class DocumentTitleToolCompletePayload(BaseModel):
    """Response indicating title tool completed successfully."""

    success: bool
    title: str
    trace_id: str
    message: str | None = None


class DocumentTitleToolErrorPayload(BaseModel):
    """Response indicating an error occurred in title tool."""

    success: bool
    message: str
    trace_id: str


async def document_title_tool_complete(
    payload: DocumentTitleToolCompletePayload, room: str
) -> None:
    await emit_to_client("documents_tools_title_complete", payload, room=room)


async def document_title_tool_error(
    payload: DocumentTitleToolErrorPayload, room: str
) -> None:
    await emit_to_client("documents_tools_title_error", payload, room=room)


async def _document_tool_title_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for document title creation/update."""
    try:
        validated = DocumentTitleToolPayload(**data)
    except ValidationError as e:
        await document_title_tool_error(
            DocumentTitleToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=data.get("trace_id", "unknown"),
            ),
            room=sid,
        )
        return

    trace_id = validated.trace_id

    try:
        async with get_db_connection() as conn:
            document_id_uuid = (
                uuid.UUID(validated.document_id) if validated.document_id else None
            )

            if not document_id_uuid:
                await document_title_tool_error(
                    DocumentTitleToolErrorPayload(
                        success=False,
                        message="document_id is required",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Update document name
            sql = load_sql("app/sql/v3/document/update_document_name.sql")
            result = await conn.fetchrow(
                sql,
                str(document_id_uuid),
                validated.title,
            )

            if not result:
                await document_title_tool_error(
                    DocumentTitleToolErrorPayload(
                        success=False,
                        message="Failed to update document title",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            await document_title_tool_complete(
                DocumentTitleToolCompletePayload(
                    success=True,
                    title=validated.title,
                    trace_id=trace_id,
                    message="Updated document title successfully",
                ),
                room=sid,
            )

    except RuntimeError:
        await document_title_tool_error(
            DocumentTitleToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
    except Exception as e:
        await document_title_tool_error(
            DocumentTitleToolErrorPayload(
                success=False,
                message=f"Error updating document title: {str(e)}",
                trace_id=trace_id,
            ),
            room=sid,
        )


@internal_sio.on("document_tool_title")  # type: ignore
async def document_tool_title_internal(data: dict[str, Any]) -> None:
    """Handle document_tool_title event from internal bus (server-to-server)."""
    # Extract sid from payload if available, otherwise use a default
    sid = data.get("sid", "internal")
    await _document_tool_title_impl(sid, data)


# Register OpenAPI endpoints
register_client_endpoint(
    client_router,
    "/document_tool_title",
    DocumentTitleToolPayload,
    "Create/update document title",
)

"""Handler for document_tool_title WebSocket event."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

# Types will be auto-generated from SQL introspection
try:
    from app.sql.types import (
        DocumentTitleToolApiRequest,
        DocumentTitleToolCompleteApiRequest,
        DocumentTitleToolErrorApiRequest,
        UpdateDocumentNameSqlParams,
        UpdateDocumentNameSqlRow,
    )
except ImportError:
    # Types not generated yet - using BaseModel as fallback
    from pydantic import BaseModel

    class UpdateDocumentNameSqlParams(BaseModel):
        document_id: uuid.UUID
        name: str

    class UpdateDocumentNameSqlRow(BaseModel):
        document_id: uuid.UUID
        name: str

    class DocumentTitleToolApiRequest(BaseModel):
        trace_id: str
        title: str
        document_id: str | None = None

    class DocumentTitleToolCompleteApiRequest(BaseModel):
        success: bool
        title: str
        trace_id: str
        message: str | None = None

    class DocumentTitleToolErrorApiRequest(BaseModel):
        success: bool
        message: str
        trace_id: str


internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/documents/update_document_name_complete.sql"


async def _document_tool_title_impl(
    sid: str,
    data: DocumentTitleToolApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for document title creation/update."""
    trace_id = data.trace_id

    try:
        async with get_db_connection() as conn:
            document_id_uuid = uuid.UUID(data.document_id) if data.document_id else None

            if not document_id_uuid:
                await emit_to_client(
                    "documents_tools_title_error",
                    DocumentTitleToolErrorApiRequest(
                        success=False,
                        message="document_id is required",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Update document name using execute_sql_typed()
            params = UpdateDocumentNameSqlParams(
                document_id=document_id_uuid,
                name=data.title,
            )
            result = cast(
                UpdateDocumentNameSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                await emit_to_client(
                    "documents_tools_title_error",
                    DocumentTitleToolErrorApiRequest(
                        success=False,
                        message="Failed to update document title",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            await emit_to_client(
                "documents_tools_title_complete",
                DocumentTitleToolCompleteApiRequest(
                    success=True,
                    title=result.name,
                    trace_id=trace_id,
                    message="Updated document title successfully",
                ),
                room=sid,
            )

    except RuntimeError:
        await emit_to_client(
            "documents_tools_title_error",
            DocumentTitleToolErrorApiRequest(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
    except Exception as e:
        await emit_to_client(
            "documents_tools_title_error",
            DocumentTitleToolErrorApiRequest(
                success=False,
                message=f"Error updating document title: {str(e)}",
                trace_id=trace_id,
            ),
            room=sid,
        )


@internal_sio.on("document_tool_title")  # type: ignore
async def document_tool_title_internal(data: dict[str, Any]) -> None:
    """Handle document_tool_title event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=DocumentTitleToolApiRequest,
        handler=_document_tool_title_impl,  # type: ignore[arg-type]
        error_event_name="documents_tools_title_error",
        error_response_type=DocumentTitleToolErrorApiRequest,
    )


# Register OpenAPI endpoints
register_client_endpoint(
    client_router,
    "/document_tool_title",
    DocumentTitleToolApiRequest,
    "Create/update document title",
)

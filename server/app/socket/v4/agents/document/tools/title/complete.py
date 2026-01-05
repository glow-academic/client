"""Handler for document_title_complete - finalizes create_title tool calls and updates document name."""

import json
import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio

# Types will be auto-generated from SQL introspection
try:
    from app.sql.types import (
        DocumentTitleToolCompleteApiRequest,
        DocumentTitleToolErrorApiRequest,
        UpdateDocumentNameSqlParams,
        UpdateDocumentNameSqlRow,
    )
except ImportError:
    from pydantic import BaseModel

    class UpdateDocumentNameSqlParams(BaseModel):
        document_id: uuid.UUID
        name: str

    class UpdateDocumentNameSqlRow(BaseModel):
        document_id: uuid.UUID
        name: str

    class DocumentTitleToolCompleteApiRequest(BaseModel):
        success: bool
        title: str
        trace_id: str | None = None
        message: str | None = None

    class DocumentTitleToolErrorApiRequest(BaseModel):
        success: bool
        message: str
        trace_id: str | None = None


internal_sio = get_internal_sio()

server_router = APIRouter()

SQL_PATH = "app/sql/v4/documents/update_document_name_complete.sql"


class DocumentTitleCompletePayload(BaseModel):
    """Document title tool complete event."""

    sid: str
    document_id: str | None = None
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    final_content: str
    arguments_raw: str


class DocumentTitleCompleteErrorPayload(BaseModel):
    """Error response for document title complete."""

    success: bool
    message: str


async def _document_title_complete_impl(
    sid: str,
    data: DocumentTitleCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle document_title_complete - parses arguments and updates document name."""
    try:
        if not data.document_id:
            await internal_sio.emit(
                "document_title_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": "Missing document_id",
                },
            )
            return

        document_id_uuid = uuid.UUID(data.document_id)

        async with get_db_connection() as conn:
            # Parse tool arguments to extract title
            try:
                final_args = json.loads(data.arguments_raw)
                title = final_args.get("title", "")
            except json.JSONDecodeError:
                # Try to parse from final_content if arguments_raw is invalid
                try:
                    final_args = json.loads(data.final_content)
                    title = final_args.get("title", "")
                except (json.JSONDecodeError, TypeError):
                    await internal_sio.emit(
                        "document_title_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": "Failed to parse tool arguments",
                        },
                    )
                    return

            if not title:
                await internal_sio.emit(
                    "document_title_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Missing title in tool arguments",
                    },
                )
                return

            # Update document name using execute_sql_typed()
            params = UpdateDocumentNameSqlParams(
                document_id=document_id_uuid,
                name=title,
            )
            result = cast(
                UpdateDocumentNameSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                await internal_sio.emit(
                    "document_title_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Failed to update document title",
                    },
                )
                return

            # Emit completion to client
            await sio.emit(
                "documents_tools_title_complete",
                DocumentTitleToolCompleteApiRequest(
                    success=True,
                    title=result.name,
                    trace_id=None,  # Not available in this context
                    message="Updated document title successfully",
                ).model_dump(),
                room=sid,
            )

    except Exception as e:
        await internal_sio.emit(
            "document_title_error",
            {
                "sid": sid,
                "success": False,
                "message": f"Failed to finalize: {str(e)}",
            },
        )


@internal_sio.on("document_title_complete")  # type: ignore
async def document_title_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle document_title_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=DocumentTitleCompletePayload,
        handler=_document_title_complete_impl,  # type: ignore[arg-type]
        error_event_name="document_title_error",
        error_response_type=DocumentTitleCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/document_title_complete",
    DocumentTitleCompletePayload,
    "Document title tool completed successfully",
)

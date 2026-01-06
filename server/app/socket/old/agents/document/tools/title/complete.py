"""Handler for document_tool_title_complete - all types auto-generated from SQL."""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from app.sql.types import (
    DocumentToolTitleCompleteApiRequest,
    DocumentToolTitleCompleteSqlParams,
    DocumentToolTitleCompleteSqlRow,
)
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/documents/tools/title/document_tool_title_complete_complete.sql"


async def _document_tool_title_complete_impl(
    sid: str,
    data: DocumentToolTitleCompleteApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle title tool completion - SQL finalizes tool_call and updates document."""
    try:
        if not data.document_id:
            await internal_sio.emit(
                "document_tool_title_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": "Missing document_id",
                },
            )
            return

        async with get_db_connection() as conn:
            # Call SQL - SQL finalizes tool_call, updates document name
            params = DocumentToolTitleCompleteSqlParams(
                run_id=uuid.UUID(data.run_id),
                tool_call_id=data.tool_call_id,
                call_id=data.call_id,
                document_id=uuid.UUID(data.document_id),
            )

            result = cast(
                DocumentToolTitleCompleteSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Emit completion to client
            await emit_to_client(
                "documents_tools_title_complete",
                {
                    "success": True,
                    "title": result.title,
                    "document_id": str(result.document_id),
                    "message": "Updated document title successfully",
                },
                room=sid,
            )

    except RuntimeError:
        await emit_to_client(
            "documents_error",
            {"success": False, "message": "Database connection unavailable"},
            room=sid,
        )
    except Exception as e:
        await internal_sio.emit(
            "document_tool_title_error",
            {"sid": sid, "success": False, "message": str(e)},
        )


@internal_sio.on("document_tool_title_complete")  # type: ignore
async def document_tool_title_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle document_tool_title_complete event."""
    await handle_internal_event(
        data=data,
        request_type=DocumentToolTitleCompleteApiRequest,
        handler=_document_tool_title_complete_impl,  # type: ignore[arg-type]
        error_event_name="document_tool_title_error",
        error_response_type=None,  # Auto-generated if error SQL exists
    )


register_server_endpoint(
    server_router,
    "/document_tool_title_complete",
    DocumentToolTitleCompleteApiRequest,
    "Title tool completed successfully",
)

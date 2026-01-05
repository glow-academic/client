"""Handler for document_progress - routes by tool_type from SQL."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio
from app.sql.types import (
    DocumentToolProgressUpdateApiRequest,
    DocumentToolProgressUpdateSqlParams,
    DocumentToolProgressUpdateSqlRow,
)
from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/documents/document_tool_progress_update_complete.sql"

# Map tool_type enum to event name (stable mapping based on enum)
TOOL_TYPE_EVENT_MAP = {
    "title": "document_tool_title_progress",
    "html": "document_tool_html_progress",
    "schema": "document_tool_schema_progress",
}


async def _document_progress_impl(
    sid: str,
    data: DocumentToolProgressUpdateApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle progress - SQL accumulates arguments, returns tool_type for routing."""
    if data.progress_type not in ("tool_call_start", "tool_call_progress"):
        return

    try:
        async with get_db_connection() as conn:
            # Call SQL - SQL handles tool lookup, tool_call creation, argument accumulation
            # Get arguments_delta from data (may be arguments_raw or arguments_delta)
            arguments_delta = (
                getattr(data, "arguments_delta", None)
                or getattr(data, "arguments_raw", "")
                or ""
            )

            params = DocumentToolProgressUpdateSqlParams(
                run_id=uuid.UUID(data.run_id),
                tool_call_id=data.tool_call_id,
                call_id=data.call_id,
                tool_name=data.tool_name,
                arguments_delta=arguments_delta,  # Delta - SQL accumulates
                progress_type=data.progress_type,
                document_id=uuid.UUID(data.document_id) if data.document_id else None,
            )

            result = cast(
                DocumentToolProgressUpdateSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # SQL returns tool_type (stable enum) - use this for routing!
            tool_type = result.tool_type  # e.g., "title", "html", "schema"

            # Route based on tool_type (not tool_name!)
            tool_event_name = TOOL_TYPE_EVENT_MAP.get(tool_type)

            if not tool_event_name:
                await internal_sio.emit(
                    "document_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Unknown tool_type: {tool_type}",
                    },
                )
                return

            # Forward to tool-specific handler
            await internal_sio.emit(
                tool_event_name,
                {
                    "sid": sid,
                    "type": data.progress_type,
                    "document_id": data.document_id,
                    "run_id": data.run_id,
                    "tool_call_id": result.tool_call_id,
                    "call_id": result.persisted_call_id,
                    "tool_id": str(result.tool_id),
                    "tool_type": tool_type,  # Pass tool_type (stable enum)
                    "tool_name": result.tool_name,  # For reference only
                    "arguments_raw": result.arguments_raw,  # Accumulated by SQL
                },
            )

    except RuntimeError:
        await internal_sio.emit(
            "document_error",
            {
                "sid": sid,
                "success": False,
                "message": "Database connection unavailable",
            },
        )
    except Exception as e:
        await internal_sio.emit(
            "document_error",
            {
                "sid": sid,
                "success": False,
                "message": f"Progress update failed: {str(e)}",
            },
        )


@internal_sio.on("document_progress")  # type: ignore
async def document_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle document_progress event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=DocumentToolProgressUpdateApiRequest,
        handler=_document_progress_impl,  # type: ignore[arg-type]
        error_event_name="document_error",
        error_response_type=None,  # Will be auto-generated from error SQL if needed
    )


register_server_endpoint(
    server_router,
    "/document_progress",
    DocumentToolProgressUpdateApiRequest,
    "Handle document tool progress updates",
)

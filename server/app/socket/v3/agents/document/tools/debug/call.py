"""Handler for debug_info WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio

# Types will be auto-generated from SQL introspection
try:
    from app.sql.types import (
        DebugInfoSqlParams,
        DebugInfoSqlRow,
        DocumentDebugToolApiRequest,
        DocumentDebugToolCompleteApiRequest,
        DocumentDebugToolErrorApiRequest,
    )
except ImportError:
    # Types not generated yet - using BaseModel as fallback
    from pydantic import BaseModel

    class DocumentDebugToolApiRequest(BaseModel):
        info: str

    class DocumentDebugToolCompleteApiRequest(BaseModel):
        success: bool
        message: str | None = None

    class DocumentDebugToolErrorApiRequest(BaseModel):
        success: bool
        message: str

internal_sio = get_internal_sio()

server_router = APIRouter()

SQL_PATH = "app/sql/v3/tools/tools_debug_call_complete.sql"


async def _document_debug_impl(
    sid: str,
    data: DocumentDebugToolApiRequest,
    profile_id: Any,
    group_id: Any | None = None,
) -> None:
    """Internal implementation for debug_info tool."""
    try:
        async with get_db_connection() as conn:
            # Execute debug_info tool call (no-op for now, just emits event)
            # Emit complete event via internal bus
            await emit_to_internal(
                "document_tool_debug_complete",
                DocumentDebugToolCompleteApiRequest(
                    success=True,
                    message="Debug information logged successfully",
                ),
                sid=sid,
            )

    except RuntimeError:
        await emit_to_internal(
            "document_tool_debug_error",
            DocumentDebugToolErrorApiRequest(
                success=False,
                message="Database connection pool not available",
            ),
            sid=sid,
        )
    except Exception as e:
        await emit_to_internal(
            "document_tool_debug_error",
            DocumentDebugToolErrorApiRequest(
                success=False,
                message=f"Internal error: {str(e)}",
            ),
            sid=sid,
        )


@internal_sio.on("document_tool_debug")  # type: ignore
async def document_tool_debug_internal(data: dict[str, Any]) -> None:
    """Handle document_tool_debug event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=DocumentDebugToolApiRequest,
        handler=_document_debug_impl,  # type: ignore[arg-type]
        error_event_name="document_tool_debug_error",
        error_response_type=DocumentDebugToolErrorApiRequest,
    )


register_server_endpoint(
    server_router,
    "/document_tool_debug",
    DocumentDebugToolApiRequest,
    "Debug info tool handler",
)

"""Handler for document_complete WebSocket event - dispatches to tool-specific handlers by tool_type."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

server_router = APIRouter()

# Map tool_type enum to event name (stable mapping based on enum)
TOOL_TYPE_COMPLETE_EVENT_MAP = {
    "title": "document_tool_title_complete",
    "html": "document_tool_html_complete",
    "schema": "document_tool_schema_complete",
}


async def _document_complete_impl(
    sid: str,
    data: dict[str, Any],  # Will use auto-generated type when available
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific complete handler by tool_type."""
    if data.get("type") == "tool_call_complete":
        # Get tool_type from data (should be passed from generate.py)
        tool_type = data.get("tool_type")
        
        if not tool_type:
            # Fallback: try to get from tool_name (for backward compatibility during migration)
            tool_name = data.get("tool_name")
            if tool_name == "create_title":
                tool_type = "title"
            elif tool_name == "generate_html":
                tool_type = "html"
            elif tool_name == "generate_schema":
                tool_type = "schema"
        
        # Route based on tool_type (stable enum)
        tool_event_name = TOOL_TYPE_COMPLETE_EVENT_MAP.get(tool_type) if tool_type else None
        
        if tool_event_name:
            await internal_sio.emit(
                tool_event_name,
                {
                    "sid": data.get("sid"),
                    "document_id": data.get("document_id"),
                    "run_id": data.get("run_id"),
                    "tool_call_id": data.get("tool_call_id") or "",
                    "call_id": data.get("call_id"),
                },
            )
        else:
            await internal_sio.emit(
                "document_error",
                {
                    "sid": data.get("sid"),
                    "success": False,
                    "message": f"Unknown tool_type for completion: {tool_type}",
                },
            )

    elif data.get("type") == "run_complete":
        # All tools done - emit overall completion
        await sio.emit(
            "documents_complete",
            {
                "success": True,
                "document_id": data.get("document_id"),
                "message": "Document generation completed successfully",
            },
            room=sid,
        )


@internal_sio.on("document_complete")  # type: ignore
async def document_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle document_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=None,  # Will use auto-generated type when available
        handler=_document_complete_impl,  # type: ignore[arg-type]
        error_event_name="document_error",
        error_response_type=None,  # Auto-generated if error SQL exists
    )


register_server_endpoint(
    server_router,
    "/document_complete",
    None,  # Will use auto-generated type when available
    "Dispatch document complete to tool-specific handlers by tool_type",
)

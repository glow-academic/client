"""Handler for document_complete WebSocket event - dispatches to tool-specific handlers and tracks overall completion."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class DocumentCompletePayload(BaseModel):
    """Generic document complete event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_complete" | "run_complete"
    document_id: str | None = None
    run_id: str
    tool_name: str | None = None
    tool_call_id: str | None = None
    call_id: str | None = None
    final_content: str | None = None
    arguments_raw: str | None = None


class DocumentCompleteErrorPayload(BaseModel):
    """Error response for document complete."""

    success: bool
    message: str


class DocumentGenerateCompletePayload(BaseModel):
    """Payload for document_generate_complete client event."""

    success: bool
    document_id: str | None = None
    message: str | None = None


async def _document_complete_impl(
    sid: str,
    data: DocumentCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific complete handler."""
    if data.type == "tool_call_complete":
        # Route to appropriate tool handler
        if data.tool_name == "create_title":
            await internal_sio.emit(
                "document_title_complete",
                {
                    "sid": data.sid,
                    "document_id": data.document_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id or "",
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "final_content": data.final_content or "",
                    "arguments_raw": data.arguments_raw or "",
                },
            )
        elif data.tool_name == "generate_html":
            await internal_sio.emit(
                "document_template_html_complete",
                {
                    "sid": data.sid,
                    "document_id": data.document_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id or "",
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "final_content": data.final_content or "",
                    "arguments_raw": data.arguments_raw or "",
                },
            )
        elif data.tool_name == "generate_schema":
            await internal_sio.emit(
                "document_template_schema_complete",
                {
                    "sid": data.sid,
                    "document_id": data.document_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id or "",
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "final_content": data.final_content or "",
                    "arguments_raw": data.arguments_raw or "",
                },
            )

    elif data.type == "run_complete":
        # All tools done - emit overall completion
        await sio.emit(
            "documents_complete",
            DocumentGenerateCompletePayload(
                success=True,
                document_id=data.document_id,
                message="Document generation completed successfully",
            ).model_dump(),
            room=sid,
        )


@internal_sio.on("document_complete")  # type: ignore
async def document_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle document_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=DocumentCompletePayload,
        handler=_document_complete_impl,  # type: ignore[arg-type]
        error_event_name="document_complete_error",
        error_response_type=DocumentCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/document_complete",
    DocumentCompletePayload,
    "Dispatch document complete to tool-specific handlers",
)

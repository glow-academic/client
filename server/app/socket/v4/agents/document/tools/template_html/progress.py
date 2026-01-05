"""Handler for document_template_html_progress - handles incremental updates for generate_html tool calls."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class DocumentTemplateHtmlProgressPayload(BaseModel):
    """Document template HTML tool progress event."""

    sid: str
    type: str  # "tool_call_start" | "tool_call_progress"
    document_id: str | None = None
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    arguments_raw: str


class DocumentTemplateHtmlProgressErrorPayload(BaseModel):
    """Error response for document template HTML progress."""

    success: bool
    message: str


# Client-facing payload models
class DocumentProgressPayload(BaseModel):
    """Progress update for document generation."""

    type: str
    document_id: str | None = None
    tool_name: str | None = None
    arguments_raw: str | None = None


async def _document_template_html_progress_impl(
    sid: str,
    data: DocumentTemplateHtmlProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle document_template_html_progress - tracks progress and emits to client."""
    try:
        if data.type == "tool_call_start":
            # Tool call started - no-op for now, will be handled on first progress
            pass

        elif data.type == "tool_call_progress":
            # Emit progress to client
            await sio.emit(
                "documents_progress",
                DocumentProgressPayload(
                    type="tool_call_progress",
                    document_id=data.document_id,
                    tool_name=data.tool_name,
                    arguments_raw=data.arguments_raw,
                ).model_dump(),
                room=sid,
            )

    except Exception as e:
        await internal_sio.emit(
            "document_template_html_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@internal_sio.on("document_template_html_progress")  # type: ignore
async def document_template_html_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle document_template_html_progress event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=DocumentTemplateHtmlProgressPayload,
        handler=_document_template_html_progress_impl,  # type: ignore[arg-type]
        error_event_name="document_template_html_error",
        error_response_type=DocumentTemplateHtmlProgressErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/document_template_html_progress",
    DocumentTemplateHtmlProgressPayload,
    "Progress update for Document template HTML tool",
)

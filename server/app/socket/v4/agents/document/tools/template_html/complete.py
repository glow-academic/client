"""Handler for document_template_html_complete - finalizes generate_template_html tool calls."""

import json
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class DocumentTemplateHtmlCompletePayload(BaseModel):
    """Document template HTML tool complete event."""

    sid: str
    document_id: str | None = None
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    final_content: str
    arguments_raw: str


class DocumentTemplateHtmlCompleteErrorPayload(BaseModel):
    """Error response for document template HTML complete."""

    success: bool
    message: str


async def _document_template_html_complete_impl(
    sid: str,
    data: DocumentTemplateHtmlCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle document_template_html_complete - parses arguments and stores template HTML."""
    try:
        # Parse tool arguments to extract template_html
        try:
            final_args = json.loads(data.arguments_raw)
            template_html = final_args.get("template_html", "")
        except json.JSONDecodeError:
            # Try to parse from final_content if arguments_raw is invalid
            try:
                final_args = json.loads(data.final_content)
                template_html = final_args.get("template_html", "")
            except (json.JSONDecodeError, TypeError):
                await internal_sio.emit(
                    "document_template_html_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Failed to parse tool arguments",
                    },
                )
                return

        # Template HTML is stored in document_results dict in generate.py
        # Just emit completion to client
        await sio.emit(
            "documents_progress",
            {
                "type": "tool_complete",
                "document_id": data.document_id,
                "tool_name": data.tool_name,
                "message": "Template HTML generated successfully",
            },
            room=sid,
        )

    except Exception as e:
        await internal_sio.emit(
            "document_template_html_error",
            {
                "sid": sid,
                "success": False,
                "message": f"Failed to finalize: {str(e)}",
            },
        )


@internal_sio.on("document_template_html_complete")  # type: ignore
async def document_template_html_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle document_template_html_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=DocumentTemplateHtmlCompletePayload,
        handler=_document_template_html_complete_impl,  # type: ignore[arg-type]
        error_event_name="document_template_html_error",
        error_response_type=DocumentTemplateHtmlCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/document_template_html_complete",
    DocumentTemplateHtmlCompletePayload,
    "Document template HTML tool completed successfully",
)

"""Handler for hint_hint_complete - finalizes create_hint tool calls."""

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


class HintHintCompletePayload(BaseModel):
    """Hint hint tool complete event."""

    sid: str
    chat_id: str
    message_id: str
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    final_content: str
    arguments_raw: str


class HintHintCompleteErrorPayload(BaseModel):
    """Error response for hint hint complete."""

    success: bool
    message: str


async def _hint_hint_complete_impl(
    sid: str,
    data: HintHintCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle hint_hint_complete - parses arguments and emits completion."""
    try:
        # Parse tool arguments to extract hint
        try:
            final_args = json.loads(data.arguments_raw)
            hint = final_args.get("hint", "")
        except json.JSONDecodeError:
            # Try to parse from final_content if arguments_raw is invalid
            try:
                final_args = json.loads(data.final_content)
                hint = final_args.get("hint", "")
            except (json.JSONDecodeError, TypeError):
                await internal_sio.emit(
                    "hint_hint_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Failed to parse tool arguments",
                    },
                )
                return

        # Hint is stored in hint_results list in generate.py
        # Just emit completion to client
        await sio.emit(
            "simulation_hints_progress",
            {
                "type": "tool_complete",
                "chat_id": data.chat_id,
                "message_id": data.message_id,
                "tool_name": data.tool_name,
                "message": "Hint created successfully",
            },
            room=sid,
        )

    except Exception as e:
        await internal_sio.emit(
            "hint_hint_error",
            {
                "sid": sid,
                "success": False,
                "message": f"Failed to finalize: {str(e)}",
            },
        )


@internal_sio.on("hint_hint_complete")  # type: ignore
async def hint_hint_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle hint_hint_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=HintHintCompletePayload,
        handler=_hint_hint_complete_impl,  # type: ignore[arg-type]
        error_event_name="hint_hint_error",
        error_response_type=HintHintCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/hint_hint_complete",
    HintHintCompletePayload,
    "Hint hint tool completed successfully",
)

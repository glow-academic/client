"""Handler for generate_image_start WebSocket event - client listener that receives frontend info."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class GenerateImageStartPayload(BaseModel):
    """Request to start image generation - receives frontend info."""

    image_id: str
    name: str
    prompt: str
    agent_id: str
    department_id: str | None = None
    profile_id: str | None = None
    trace_id: str | None = None


async def _generate_image_start_impl(
    sid: str,
    data: GenerateImageStartPayload,
    profile_id: uuid.UUID,
) -> None:
    """Client listener - validates payload and emits internal event to trigger call.py."""
    # Validate payload and emit internal event to trigger call.py
    # Does NOT emit to client (that's handled by call.py/complete.py)
    await emit_to_internal(
        "generate_image",
        {
            "sid": sid,
            "image_id": data.image_id,
            "name": data.name,
            "prompt": data.prompt,
            "agent_id": data.agent_id,
            "department_id": data.department_id,
            "profile_id": data.profile_id,
            "trace_id": data.trace_id,
        },
        sid=sid,
    )


@sio.event  # type: ignore
async def generate_image_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    # Server always expects snake_case - frontend must convert camelCase before sending
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GenerateImageStartPayload,
        handler=_generate_image_start_impl,  # type: ignore[arg-type]
        error_event_name="images_generation_error",
        error_response_type=None,
    )


register_client_endpoint(
    client_router,
    "/generate_image_start",
    GenerateImageStartPayload,
    "Start image generation - receives frontend info",
)

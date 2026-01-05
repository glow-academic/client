"""Handler for generate_image_error WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import load_sql

from app.infra.v4.websocket.get_db_connection import get_db_connection

internal_sio = get_internal_sio()
server_router = APIRouter()


class ImageErrorPayload(BaseModel):
    """Response indicating an error occurred in image generation."""

    success: bool
    image_id: str
    message: str


async def _generate_image_error_impl(
    sid: str,
    data: ImageErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client and updates image record."""
    # Update image record: mark as completed (even on error) to prevent retries
    try:
        async with get_db_connection() as conn:
            sql_update_image = load_sql("app/sql/v4/images/update_image_completed.sql")
            await conn.execute(sql_update_image, uuid.UUID(data.image_id), True)
    except Exception:
        pass

    await emit_to_client(
        "images_generation_error",
        data,
        room=sid,
    )


@internal_sio.on("generate_image_error")  # type: ignore
async def generate_image_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle generate_image_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ImageErrorPayload,
        handler=_generate_image_error_impl,  # type: ignore[arg-type]
        error_event_name="images_generation_error",
        error_response_type=ImageErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/generate_image_error",
    ImageErrorPayload,
    "Error occurred in image generation",
)

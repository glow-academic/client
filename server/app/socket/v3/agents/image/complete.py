"""Handler for image_complete WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from app.socket.v3.agents.scenario.tools.image.call import (
    ImageToolCompletePayload,
    image_tool_complete,
)

internal_sio = get_internal_sio()
server_router = APIRouter()

client_router = APIRouter()
server_router = APIRouter()


class ImageGenerationCompletePayload(BaseModel):
    """Request to complete image generation."""

    image_id: str
    file_path: str
    mime_type: str
    file_size: int
    room: str | None = None  # For emitting scenario_tool_image_complete to client
    trace_id: str | None = None  # For scenario tool completion events


async def _image_generation_complete_impl(
    sid: str,
    data: ImageGenerationCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle image generation completion request via WebSocket."""
    image_id = data.image_id
    file_path = data.file_path
    mime_type = data.mime_type
    file_size = data.file_size
    room = data.room
    trace_id = data.trace_id

    try:
        async with get_db_connection() as conn:
            # Load SQL query at top (DHH style - one SQL file per websocket event)
            sql = load_sql("app/sql/v3/images/complete_image_generation_complete.sql")

            result = await conn.fetchrow(sql, image_id, file_path, mime_type, file_size)

            if not result:
                return

            upload_id = result["upload_id"]
            # Log activity (only for client-to-server events, not internal)
            if sid and sid != "internal":
                try:
                    await log_websocket_activity(
                        sid=sid,
                        event_key="images.completed",
                        template="{{ actor.name }} completed image generation",
                        context={"image_id": image_id, "upload_id": upload_id},
                        endpoint="/socket/v3/images/complete",
                        error=False,
                    )
                except Exception:
                    pass

            # If this was triggered from scenario tool, emit completion event to client
            if room and trace_id:
                await image_tool_complete(
                    ImageToolCompletePayload(
                        success=True,
                        image_id=image_id,
                        trace_id=trace_id,
                        message=f"Image generation completed. Upload ID: {upload_id}",
                    ),
                    room=room,
                )

            # Emit to client
            await emit_to_client(
                "images_generation_complete",
                {
                    "success": True,
                    "image_id": image_id,
                    "upload_id": upload_id,
                },
                room=sid,
            )
    except RuntimeError:
        # Pool not initialized - emit error event
        await emit_to_client(
            "images_generation_error",
            {
                "success": False,
                "image_id": image_id,
                "message": "Database connection pool not available",
            },
            room=sid,
        )
    except Exception:
        pass


@internal_sio.on("image_generation_complete")  # type: ignore
async def image_generation_complete_internal(data: dict[str, Any]) -> None:
    """Handle image_generation_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ImageGenerationCompletePayload,
        handler=_image_generation_complete_impl,  # type: ignore[arg-type]
        error_event_name="images_generation_error",
        error_response_type=ImageGenerationErrorSqlRow,
    )


class ImageGenerationErrorSqlRow(BaseModel):
    """Response indicating an error occurred in image generation."""

    success: bool
    image_id: str
    message: str


register_server_endpoint(
    server_router,
    "/generation_complete",
    ImageGenerationCompletePayload,
    "Image generation completed successfully",
)

"""WebSocket handler for image_generation_complete event."""

from typing import Any

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.main import get_internal_sio, get_pool, sio
from app.socket.v3.scenarios.tools.image import (ImageToolCompletePayload,
                                                 image_tool_complete)
from fastapi import APIRouter
from pydantic import BaseModel
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

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
    sid: str, data: ImageGenerationCompletePayload
) -> None:
    """Handle image generation completion request via WebSocket."""
    image_id = data.image_id
    file_path = data.file_path
    mime_type = data.mime_type
    file_size = data.file_size
    room = data.room
    trace_id = data.trace_id

    pool = get_pool()
    if not pool:
        logger.error(f"Database pool not available for image completion {image_id}")
        return

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            # Load SQL query at top (DHH style - one SQL file per websocket event)
            sql = load_sql("app/sql/v3/images/complete_image_generation_complete.sql")

            sql_query = sql
            sql_params = (image_id, file_path, mime_type, file_size)

            result = await conn.fetchrow(sql, *sql_params)

            if not result:
                logger.error(f"Failed to complete image generation for {image_id}")
                return

            upload_id = result["upload_id"]
            logger.info(
                f"✓ Image generation completed: image_id={image_id}, upload_id={upload_id}"
            )
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
                except Exception as log_error:
                    logger.warning(
                        f"Error logging image completion activity: {log_error}"
                    )

            # If this was triggered from scenario tool, emit completion event to client
            if room and trace_id:
                logger.info(
                    f"[image_generation_complete] Emitting scenario_tool_image_complete: "
                    f"room={room}, trace_id={trace_id}, image_id={image_id}"
                )
                await image_tool_complete(
                    ImageToolCompletePayload(
                        success=True,
                        image_id=image_id,
                        trace_id=trace_id,
                        message=f"Image generation completed. Upload ID: {upload_id}",
                    ),
                    room=room,
                )

    except Exception as e:
        logger.error(
            f"Error in image generation completion for {image_id}: {e}",
            exc_info=True,
        )


@sio.event  # type: ignore
async def image_generation_complete(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler (client-to-server)."""
    try:
        payload = ImageGenerationCompletePayload(**data)
        await _image_generation_complete_impl(sid, payload)
    except Exception as e:
        logger.error(
            f"Error in image_generation_complete for {sid}: {str(e)}", exc_info=True
        )


@internal_sio.on("image_generation_complete")
async def image_generation_complete_internal(data: dict[str, Any]) -> None:
    """Handle image generation completion event from internal bus (server-to-server)."""
    try:
        payload = ImageGenerationCompletePayload(**data)
        await _image_generation_complete_impl("internal", payload)
    except Exception as e:
        logger.error(
            f"Error in image_generation_complete_internal: {str(e)}", exc_info=True
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/complete", response_model=dict[str, bool])
async def image_generation_complete_api(
    request: ImageGenerationCompletePayload,
) -> dict[str, bool]:
    """Client-to-server event: Complete image generation."""
    return {"success": True}

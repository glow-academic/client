"""Handler for generate_image_complete WebSocket event - finalizes image generation."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from app.socket.old.agents.scenario.tools.image.call import (
    ImageToolCompletePayload,
    image_tool_complete,
)
from app.sql.types import (
    CompleteImageGenerationSqlParams,
    CompleteImageGenerationSqlRow,
)
from fastapi import APIRouter
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

server_router = APIRouter()


class ImageGenerationCompletePayload(BaseModel):
    """Request to complete image generation."""

    sid: str
    image_id: str
    file_path: str
    mime_type: str
    file_size: int
    trace_id: str | None = None  # For scenario tool completion events


async def _generate_image_complete_impl(
    sid: str,
    data: ImageGenerationCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle image generation completion - creates upload and links to image."""
    image_id = data.image_id
    file_path = data.file_path
    mime_type = data.mime_type
    file_size = data.file_size
    trace_id = data.trace_id

    try:
        async with get_db_connection() as conn:
            # Use execute_sql_typed() - auto-detects function
            params = CompleteImageGenerationSqlParams(
                image_id=uuid.UUID(image_id),
                file_path=file_path,
                mime_type=mime_type,
                file_size=file_size,
            )
            result = cast(
                CompleteImageGenerationSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/images/complete_image_generation_complete.sql",
                    params=params,
                ),
            )

            if not result:
                await internal_sio.emit(
                    "generate_image_error",
                    {
                        "sid": sid,
                        "image_id": image_id,
                        "error_message": "Failed to complete image generation",
                    },
                )
                return

            upload_id = result.upload_id

            # If this was triggered from scenario tool, emit completion event to client
            if trace_id:
                await image_tool_complete(
                    ImageToolCompletePayload(
                        success=True,
                        image_id=image_id,
                        trace_id=trace_id,
                        message=f"Image generation completed. Upload ID: {upload_id}",
                    ),
                    room=sid,
                )

            # Invalidate cache
            await invalidate_tags(["images"])

            # Emit to client
            await emit_to_client(
                "images_generation_complete",
                {
                    "success": True,
                    "image_id": image_id,
                    "upload_id": str(upload_id),
                },
                room=sid,
            )
    except RuntimeError:
        # Pool not initialized - emit error event
        await internal_sio.emit(
            "generate_image_error",
            {
                "sid": sid,
                "image_id": image_id,
                "error_message": "Database connection pool not available",
            },
        )
    except Exception as e:
        await internal_sio.emit(
            "generate_image_error",
            {
                "sid": sid,
                "image_id": image_id,
                "error_message": f"Failed to finalize image generation: {str(e)}",
            },
        )


@internal_sio.on("generate_image_complete")  # type: ignore
async def generate_image_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle generate_image_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ImageGenerationCompletePayload,
        handler=_generate_image_complete_impl,  # type: ignore[arg-type]
        error_event_name="generate_image_error",
        error_response_type=None,
    )


register_server_endpoint(
    server_router,
    "/generate_image_complete",
    ImageGenerationCompletePayload,
    "Image generation completed successfully",
)

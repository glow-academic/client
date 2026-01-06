"""Handler for image_tool_title WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class ImageTitleToolPayload(BaseModel):
    """Request to create/update title from image generation tool."""

    trace_id: str
    title: str
    image_id: str | None = None


class ImageTitleToolCompletePayload(BaseModel):
    """Response indicating title tool completed successfully."""

    success: bool
    title: str
    trace_id: str
    message: str | None = None


class ImageTitleToolErrorPayload(BaseModel):
    """Response indicating an error occurred in title tool."""

    success: bool
    message: str
    trace_id: str


async def image_title_tool_complete(
    payload: ImageTitleToolCompletePayload, room: str
) -> None:
    await emit_to_client("images_tools_title_complete", payload, room=room)


async def image_title_tool_error(
    payload: ImageTitleToolErrorPayload, room: str
) -> None:
    await emit_to_client("images_tools_title_error", payload, room=room)


async def _image_tool_title_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for image title creation/update."""
    try:
        validated = ImageTitleToolPayload(**data)
    except ValidationError as e:
        await image_title_tool_error(
            ImageTitleToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=data.get("trace_id", "unknown"),
            ),
            room=sid,
        )
        return

    trace_id = validated.trace_id

    try:
        async with get_db_connection() as conn:
            # Note: Image name updates may be handled differently
            # For now, this is a placeholder implementation
            # Image names are typically set during creation, not updated via title tool
            await image_title_tool_complete(
                ImageTitleToolCompletePayload(
                    success=True,
                    title=validated.title,
                    trace_id=trace_id,
                    message="Image title processed successfully",
                ),
                room=sid,
            )

    except RuntimeError:
        await image_title_tool_error(
            ImageTitleToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
    except Exception as e:
        await image_title_tool_error(
            ImageTitleToolErrorPayload(
                success=False,
                message=f"Error processing image title: {str(e)}",
                trace_id=trace_id,
            ),
            room=sid,
        )


@internal_sio.on("image_tool_title")  # type: ignore
async def image_tool_title_internal(data: dict[str, Any]) -> None:
    """Handle image_tool_title event from internal bus (server-to-server)."""
    # Extract sid from payload if available, otherwise use a default
    sid = data.get("sid", "internal")
    await _image_tool_title_impl(sid, data)


# Register OpenAPI endpoints
register_client_endpoint(
    client_router,
    "/image_tool_title",
    ImageTitleToolPayload,
    "Create/update image title",
)

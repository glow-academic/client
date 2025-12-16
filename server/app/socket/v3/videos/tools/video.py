"""Handler for video_tool_video WebSocket event."""

import uuid
from typing import Any

from app.main import get_internal_sio, get_pool, sio
from app.utils.logging.db_logger import get_logger
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)
internal_sio = get_internal_sio()


class VideoToolPayload(BaseModel):
    trace_id: str
    prompt: str
    video_id: str
    image_ids: list[str] | None = None  # If provided, video generation waits for images
    agent_id: str
    department_id: str | None = None


class VideoToolCompletePayload(BaseModel):
    success: bool
    generation_id: str | None = None
    trace_id: str
    message: str | None = None


class VideoToolErrorPayload(BaseModel):
    success: bool
    message: str
    trace_id: str


async def video_tool_complete(payload: VideoToolCompletePayload, room: str) -> None:
    logger.info(
        f"[video_tool_video_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, "
        f"generation_id={payload.generation_id}"
    )
    await sio.emit("video_tool_complete", payload.model_dump(), room=room)
    logger.info(f"[video_tool_video_complete] Emitted to room={room}")


async def video_tool_error(payload: VideoToolErrorPayload, room: str) -> None:
    await sio.emit("video_tool_error", payload.model_dump(), room=room)


async def _video_tool_video_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for video generation."""
    logger.info(
        f"[video_tool_video] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = VideoToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in video_tool_video for {sid}: {e}")
        await video_tool_error(
            VideoToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=data.get("trace_id", "unknown"),
            ),
            room=sid,
        )
        return

    trace_id = validated.trace_id
    pool = get_pool()

    if not pool:
        await video_tool_error(
            VideoToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    try:
        video_id_uuid = uuid.UUID(validated.video_id)

        # If image_ids provided, check if this is a retry after images completed
        # (image tool calls this again when images are ready)
        if validated.image_ids and len(validated.image_ids) > 0:
            # Check if images are already complete (this call came from image tool)
            # If so, proceed with video generation immediately
            # Otherwise, store as pending and wait
            import app.socket.v3.videos.tools.image as image_tool_module

            # Check if this video_id was already pending (meaning images just completed)
            was_pending = (
                validated.video_id in image_tool_module._pending_video_generations
            )

            if was_pending:
                # Images are ready - proceed with video generation
                logger.info(
                    f"All images ready for video {validated.video_id}, starting generation"
                )
                # Remove from pending
                del image_tool_module._pending_video_generations[validated.video_id]
                # Fall through to video generation below
            else:
                # Store pending video generation - image tool will trigger when ready
                image_tool_module._pending_video_generations[validated.video_id] = {
                    "image_ids": set(validated.image_ids),
                    "prompt": validated.prompt,
                    "agent_id": validated.agent_id,
                    "department_id": validated.department_id,
                    "sid": sid,
                    "trace_id": trace_id,
                }
                logger.info(
                    f"Video generation queued for {validated.video_id}, waiting for {len(validated.image_ids)} images"
                )
                # Don't emit completion yet - image tool will trigger actual generation
                return

        # No images required OR images are ready - call video generation handler directly
        from app.socket.v3.videos.generate import (GenerateVideoPayload,
                                                   _video_generate_impl)

        video_payload = GenerateVideoPayload(
            videoId=validated.video_id,
            prompt=validated.prompt,
            imageReferenceId=validated.image_ids[0]
            if validated.image_ids and len(validated.image_ids) > 0
            else None,
        )

        # Call video generation handler directly (it will handle its own events)
        # Run in background to avoid blocking
        import asyncio

        asyncio.create_task(_video_generate_impl(sid, video_payload))

        logger.info(
            f"✓ Triggered video generation for {validated.video_id} "
            f"(trace_id={trace_id})"
        )

        # Note: Actual video generation completion is handled by video_generate handler
        # We emit a completion event here to indicate the request was accepted
        await video_tool_complete(
            VideoToolCompletePayload(
                success=True,
                generation_id=None,  # Will be set by video_generate handler
                trace_id=trace_id,
                message="Video generation started",
            ),
            room=sid,
        )

    except Exception as e:
        logger.error(f"Error in video_tool_video for {sid}: {str(e)}", exc_info=True)
        await video_tool_error(
            VideoToolErrorPayload(success=False, message=str(e), trace_id=trace_id),
            room=sid,
        )


@sio.event  # type: ignore
async def video_tool_video(sid: str, data: dict[str, Any]) -> None:
    """Handle video generation event from video outline generation tool (client-to-server)."""
    await _video_tool_video_impl(sid, data)


@internal_sio.on("video_tool_video")
async def video_tool_video_internal(data: dict[str, Any]) -> None:
    """Handle video generation event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        logger.error("[video_tool_video_internal] Missing 'sid' in payload")
        return
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _video_tool_video_impl(sid, payload)

"""Handler for scenario_tool_video WebSocket event."""

import time
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger

from app.main import get_internal_sio, get_pool, sio

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class ScenarioVideoToolPayload(BaseModel):
    """Request to generate video from scenario generation tool."""

    trace_id: str
    prompt: str
    scenario_id: str
    video_id: str | None = None  # Optional: if provided, update existing video
    image_ids: list[str] | None = None  # If provided, video generation waits for images
    images_ready: bool | None = None  # Set by image tool when images are ready
    agent_id: str
    department_id: str | None = None


class ScenarioVideoToolCompletePayload(BaseModel):
    """Response indicating video tool completed successfully."""

    success: bool
    generation_id: str | None = None
    video_id: str | None = None
    trace_id: str
    message: str | None = None


class ScenarioVideoToolErrorPayload(BaseModel):
    """Response indicating an error occurred in video tool."""

    success: bool
    message: str
    trace_id: str


async def scenario_video_tool_complete(
    payload: ScenarioVideoToolCompletePayload, room: str
) -> None:
    logger.info(
        f"[scenario_tool_video_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, "
        f"generation_id={payload.generation_id}, video_id={payload.video_id}"
    )
    await sio.emit("scenarios_tools_video_complete", payload.model_dump(), room=room)
    logger.info(f"[scenario_tool_video_complete] Emitted to room={room}")


async def scenario_video_tool_error(
    payload: ScenarioVideoToolErrorPayload, room: str
) -> None:
    await sio.emit("scenarios_tools_video_error", payload.model_dump(), room=room)


async def _scenario_tool_video_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for video generation in scenario context."""
    logger.info(
        f"[scenario_tool_video] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = ScenarioVideoToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in scenario_tool_video for {sid}: {e}")
        await scenario_video_tool_error(
            ScenarioVideoToolErrorPayload(
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
        await scenario_video_tool_error(
            ScenarioVideoToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    try:
        import app.socket.v3.scenarios.tools.image as image_tool_module

        await image_tool_module._prune_pending_video_generations()
        scenario_id_uuid = uuid.UUID(validated.scenario_id)

        # If image_ids provided, check if this is a retry after images completed
        # (image tool calls this again when images are ready)
        if validated.image_ids and len(validated.image_ids) > 0:
            # Check if images are already complete (this call came from image tool)
            # If so, proceed with video generation immediately
            # Otherwise, store as pending and wait
            pending_key = f"{validated.scenario_id}:{trace_id}"

            async with image_tool_module._pending_video_generations_lock:
                # Check if this scenario_id was already pending (meaning images just completed)
                was_pending = (
                    pending_key in image_tool_module._pending_video_generations
                )

                if was_pending:
                    # Images are ready - proceed with video generation
                    logger.info(
                        f"All images ready for scenario {validated.scenario_id}, starting video generation"
                    )
                    # Remove from pending
                    pending_data = image_tool_module._pending_video_generations[
                        pending_key
                    ]
                    del image_tool_module._pending_video_generations[pending_key]
                    # Use pending video_id if available
                    validated.video_id = pending_data.get("video_id")
                    # Fall through to video generation below
                else:
                    # If image tool indicates readiness, proceed immediately
                    if validated.images_ready:
                        logger.info(
                            f"Images provided for scenario {validated.scenario_id}, starting video generation"
                        )
                    else:
                        # Store pending video generation - image tool will trigger when ready
                        image_tool_module._pending_video_generations[pending_key] = {
                            "expected_image_ids": set(validated.image_ids),
                            "completed_image_ids": set(),
                            "prompt": validated.prompt,
                            "agent_id": validated.agent_id,
                            "department_id": validated.department_id,
                            "sid": sid,
                            "trace_id": trace_id,
                            "video_id": validated.video_id,
                            "created_at": time.monotonic(),
                        }
                        logger.info(
                            f"Video generation queued for scenario {validated.scenario_id}, waiting for {len(validated.image_ids)} images"
                        )
                        # Don't emit completion yet - image tool will trigger actual generation
                        return

        # Create or update video for scenario
        # For now, we'll create a new video and link it to the scenario
        # The actual video generation will be handled by a video generation handler
        # that we'll need to adapt from the old video_generate handler

        # If video_id provided, update existing video
        # Otherwise, create new video and link to scenario
        async with pool.acquire() as conn:
            if validated.video_id:
                video_id_uuid = uuid.UUID(validated.video_id)
                # Update existing video (video generation will be handled separately)
                logger.info(
                    f"Updating video {validated.video_id} for scenario {validated.scenario_id}"
                )
            else:
                # Create new video and link to scenario
                from utils.sql_helper import load_sql

                async with conn.transaction():
                    # Create video
                    create_video_sql = load_sql(
                        "app/sql/v3/videos/create_video_basic.sql"
                    )
                    video_result = await conn.fetchrow(
                        create_video_sql,
                        "Generated Video",  # name (will be updated after generation)
                        8,  # length_seconds (default, will be updated after generation)
                    )
                    if not video_result:
                        raise ValueError("Failed to create video")
                    video_id_uuid = video_result["id"]

                    # Link video to scenario (only one active at a time)
                    link_video_sql = load_sql(
                        "app/sql/v3/scenario/link_video_to_scenario.sql"
                    )
                    await conn.execute(
                        link_video_sql,
                        str(scenario_id_uuid),
                        str(video_id_uuid),
                        True,  # active
                    )
                    logger.info(
                        f"Created and linked video {video_id_uuid} to scenario {validated.scenario_id}"
                    )

        from app.socket.v3.agents.video.generate import (
            GenerateVideoPayload,
            _video_generate_impl,
        )

        await _video_generate_impl(
            sid,
            GenerateVideoPayload(
                videoId=str(video_id_uuid),
                prompt=validated.prompt,
                imageReferenceId=None,
            ),
        )

        logger.info(
            f"✓ Video tool completed for scenario {validated.scenario_id} "
            f"(video_id={video_id_uuid}, trace_id={trace_id})"
        )

        await scenario_video_tool_complete(
            ScenarioVideoToolCompletePayload(
                success=True,
                generation_id=None,
                video_id=str(video_id_uuid),
                trace_id=trace_id,
                message="Video generation completed",
            ),
            room=sid,
        )

    except Exception as e:
        logger.error(f"Error in scenario_tool_video for {sid}: {str(e)}", exc_info=True)
        await scenario_video_tool_error(
            ScenarioVideoToolErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def scenario_tool_video(sid: str, data: dict[str, Any]) -> None:
    """Handle video generation event from scenario generation tool (client-to-server)."""
    await _scenario_tool_video_impl(sid, data)


@internal_sio.on("scenario_tool_video")
async def scenario_tool_video_internal(data: dict[str, Any]) -> None:
    """Handle video generation event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        logger.error("[scenario_tool_video_internal] Missing 'sid' in payload")
        return
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _scenario_tool_video_impl(sid, payload)


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/video", response_model=dict[str, bool])
async def scenario_tool_video_api(request: ScenarioVideoToolPayload) -> dict[str, bool]:
    """Client-to-server event: Generate a video from scenario generation tool."""
    return {"success": True}


@server_router.post("/video_complete", response_model=dict[str, bool])
async def scenario_video_tool_complete_api(
    request: ScenarioVideoToolCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Video tool completed successfully."""
    return {"success": True}


@server_router.post("/video_error", response_model=dict[str, bool])
async def scenario_video_tool_error_api(
    request: ScenarioVideoToolErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in video tool."""
    return {"success": True}

"""Handler for scenario_tool_image WebSocket event."""

import asyncio
import time
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_internal_sio, get_pool, sio
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# Track pending video generations that wait for images
# Format: {scenario_id:trace_id: {"expected_image_ids": set, "completed_image_ids": set, "prompt": str, "agent_id": str, "department_id": str, "sid": str, "trace_id": str, "video_id": str}}
_pending_video_generations: dict[str, dict[str, Any]] = {}
_pending_video_generations_lock = asyncio.Lock()
_PENDING_VIDEO_TTL_SECONDS = 10 * 60


async def _prune_pending_video_generations() -> None:
    now = time.monotonic()
    async with _pending_video_generations_lock:
        stale_keys = [
            key
            for key, value in _pending_video_generations.items()
            if now - value.get("created_at", now) > _PENDING_VIDEO_TTL_SECONDS
        ]
        for key in stale_keys:
            del _pending_video_generations[key]


class ImageToolPayload(BaseModel):
    """Request to create image from scenario generation tool."""

    trace_id: str
    name: str
    prompt: str
    agent_id: str
    department_id: str | None = None
    profile_id: str | None = None
    scenario_id: str | None = None


class ImageToolCompletePayload(BaseModel):
    """Response indicating image tool completed successfully."""

    success: bool
    image_id: str
    trace_id: str
    message: str | None = None


class ImageToolErrorPayload(BaseModel):
    """Response indicating an error occurred in image tool."""

    success: bool
    message: str
    trace_id: str


async def image_tool_complete(payload: ImageToolCompletePayload, room: str) -> None:
    logger.info(
        f"[scenario_tool_image_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, "
        f"image_id={payload.image_id}"
    )
    await sio.emit("scenarios_tools_image_complete", payload.model_dump(), room=room)
    logger.info(f"[scenario_tool_image_complete] Emitted to room={room}")


async def image_tool_error(payload: ImageToolErrorPayload, room: str) -> None:
    await sio.emit("scenarios_tools_image_error", payload.model_dump(), room=room)


async def _scenario_tool_image_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for image creation."""
    logger.info(
        f"[scenario_tool_image] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = ImageToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in scenario_tool_image for {sid}: {e}")
        await image_tool_error(
            ImageToolErrorPayload(
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
        await image_tool_error(
            ImageToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    try:
        await _prune_pending_video_generations()
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Create image record immediately
                sql_insert_image = load_sql("app/sql/v3/images/insert_image_complete.sql")
                image_row = await conn.fetchrow(sql_insert_image, validated.name)

                if not image_row:
                    await image_tool_error(
                        ImageToolErrorPayload(
                            success=False,
                            message="Failed to create image record",
                            trace_id=trace_id,
                        ),
                        room=sid,
                    )
                    return

                image_id = image_row["id"]

                # Optionally link to scenario if scenario_id provided
                if validated.scenario_id:
                    scenario_id_uuid = uuid.UUID(validated.scenario_id)
                    sql_link = load_sql(
                        "app/sql/v3/scenarios/insert_scenario_image_link.sql"
                    )
                    await conn.execute(
                        sql_link,
                        str(scenario_id_uuid),
                        str(image_id),
                        True,
                    )

            # Emit to internal bus for background image generation with all context
            await internal_sio.emit(
                "generate_image",
                {
                    "image_id": image_id,
                    "name": validated.name,
                    "prompt": validated.prompt,
                    "agent_id": validated.agent_id,
                    "department_id": validated.department_id,
                    "profile_id": validated.profile_id,
                    "room": sid,
                    "trace_id": trace_id,  # Preserve trace_id for completion event
                },
            )

            logger.info(
                f"✓ Created image record {image_id} and kicked off background generation "
                f"(scenario_id={validated.scenario_id}, trace_id={trace_id})"
            )

            # Check if there's a pending video generation waiting for this image
            if validated.scenario_id:
                pending_key = f"{validated.scenario_id}:{trace_id}"
                async with _pending_video_generations_lock:
                    pending = _pending_video_generations.get(pending_key)
                    if pending:
                        completed_image_ids = pending.get(
                            "completed_image_ids", set()
                        )
                        completed_image_ids.add(str(image_id))

                        expected_image_ids = pending.get(
                            "expected_image_ids", set()
                        )

                        if expected_image_ids.issubset(completed_image_ids):
                            logger.info(
                                f"All images ready for scenario {validated.scenario_id}, triggering video generation"
                            )
                            del _pending_video_generations[pending_key]

                            # Trigger video generation by calling the handler directly
                            from app.socket.v3.scenarios.tools.video import (
                                _scenario_tool_video_impl,
                            )

                            video_payload = {
                                "trace_id": pending["trace_id"],
                                "prompt": pending["prompt"],
                                "scenario_id": validated.scenario_id,
                                "video_id": pending.get("video_id"),
                                "image_ids": list(completed_image_ids),
                                "agent_id": pending["agent_id"],
                                "department_id": pending["department_id"],
                            }

                            video_payload["images_ready"] = True
                            asyncio.create_task(
                                _scenario_tool_video_impl(pending["sid"], video_payload)
                            )

            await image_tool_complete(
                ImageToolCompletePayload(
                    success=True,
                    image_id=image_id,
                    trace_id=trace_id,
                    message=f"Image generation started for '{validated.name}'. Image ID: {image_id}",
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(f"Error in scenario_tool_image for {sid}: {str(e)}", exc_info=True)
        await image_tool_error(
            ImageToolErrorPayload(success=False, message=str(e), trace_id=trace_id),
            room=sid,
        )


@sio.event  # type: ignore
async def scenario_tool_image(sid: str, data: dict[str, Any]) -> None:
    """Handle image creation event from scenario generation tool (client-to-server)."""
    await _scenario_tool_image_impl(sid, data)


@internal_sio.on("scenario_tool_image")
async def scenario_tool_image_internal(data: dict[str, Any]) -> None:
    """Handle image creation event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        logger.error("[scenario_tool_image_internal] Missing 'sid' in payload")
        return
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _scenario_tool_image_impl(sid, payload)


# FastAPI endpoints for OpenAPI documentation
@client_router.post("/image", response_model=dict[str, bool])
async def scenario_tool_image_api(request: ImageToolPayload) -> dict[str, bool]:
    """Client-to-server event: Generate an image from scenario generation tool."""
    return {"success": True}


@server_router.post("/image_complete", response_model=dict[str, bool])
async def image_tool_complete_api(request: ImageToolCompletePayload) -> dict[str, bool]:
    """Server-to-client event: Image tool completed successfully."""
    return {"success": True}

"""Handler for scenario_tool_image WebSocket event."""

import uuid
from typing import Any

from pydantic import BaseModel, ValidationError

from app.main import get_internal_sio, get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

# Track pending video generations that wait for images
# Format: {scenario_id: {"image_ids": set, "prompt": str, "agent_id": str, "department_id": str, "sid": str, "trace_id": str, "video_id": str}}
_pending_video_generations: dict[str, dict[str, Any]] = {}


class ImageToolPayload(BaseModel):
    trace_id: str
    name: str
    prompt: str
    agent_id: str
    department_id: str | None = None
    profile_id: str | None = None
    scenario_id: str | None = None


class ImageToolCompletePayload(BaseModel):
    success: bool
    image_id: str
    trace_id: str
    message: str | None = None


class ImageToolErrorPayload(BaseModel):
    success: bool
    message: str
    trace_id: str


async def image_tool_complete(payload: ImageToolCompletePayload, room: str) -> None:
    logger.info(
        f"[scenario_tool_image_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, "
        f"image_id={payload.image_id}"
    )
    await sio.emit("scenario_tool_image_complete", payload.model_dump(), room=room)
    logger.info(f"[scenario_tool_image_complete] Emitted to room={room}")


async def image_tool_error(payload: ImageToolErrorPayload, room: str) -> None:
    await sio.emit("scenario_tool_image_error", payload.model_dump(), room=room)


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
        async with pool.acquire() as conn:
            # Create image record immediately
            sql_insert_image = load_sql("sql/v3/images/insert_image_complete.sql")
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
                sql_link = load_sql("sql/v3/scenarios/insert_scenario_image_link.sql")
                await conn.execute(
                    sql_link,
                    str(scenario_id_uuid),
                    image_id,
                    True,  # active
                )
                logger.info(f"✓ Linked image {image_id} to scenario {scenario_id_uuid}")

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
            if validated.scenario_id and validated.scenario_id in _pending_video_generations:
                pending = _pending_video_generations[validated.scenario_id]
                image_ids = pending.get("image_ids", set())
                image_ids.add(str(image_id))

                # Check if all required images are complete (for now, trigger on first image)
                if len(image_ids) > 0:
                    logger.info(
                        f"All images ready for scenario {validated.scenario_id}, triggering video generation"
                    )

                    # Trigger video generation by calling the handler directly
                    from app.socket.scenarios.tools.video import (
                        _scenario_tool_video_impl,
                    )

                    video_payload = {
                        "trace_id": pending["trace_id"],
                        "prompt": pending["prompt"],
                        "scenario_id": validated.scenario_id,
                        "video_id": pending.get("video_id"),
                        "image_ids": list(image_ids),
                        "agent_id": pending["agent_id"],
                        "department_id": pending["department_id"],
                    }

                    # Call video tool handler directly (it will handle the case where images are ready)
                    import asyncio

                    asyncio.create_task(
                        _scenario_tool_video_impl(pending["sid"], video_payload)
                    )

                    # Remove from pending
                    del _pending_video_generations[validated.scenario_id]

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

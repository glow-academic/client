"""Handler for scenario_tool_image WebSocket event."""

import uuid
from typing import Any

from app.main import get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


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
    await sio.emit("scenario_tool_image_complete", payload.model_dump(), room=room)


async def image_tool_error(payload: ImageToolErrorPayload, room: str) -> None:
    await sio.emit("scenario_tool_image_error", payload.model_dump(), room=room)


@sio.event  # type: ignore
async def scenario_tool_image(sid: str, data: dict[str, Any]) -> None:
    """Handle image creation event from scenario generation tool."""
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

            # Emit WebSocket event for background image generation with all context
            await sio.emit(
                "generate_image",
                {
                    "image_id": image_id,
                    "name": validated.name,
                    "prompt": validated.prompt,
                    "agent_id": validated.agent_id,
                    "department_id": validated.department_id,
                    "profile_id": validated.profile_id,
                    "room": sid,
                },
            )

            logger.info(
                f"✓ Created image record {image_id} and kicked off background generation "
                f"(scenario_id={validated.scenario_id}, trace_id={trace_id})"
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


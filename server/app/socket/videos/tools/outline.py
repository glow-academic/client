"""Handler for video_tool_outline WebSocket event."""

import uuid
from typing import Any

from app.main import get_internal_sio, get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)
internal_sio = get_internal_sio()


class OutlineToolPayload(BaseModel):
    trace_id: str
    name: str
    outline: str
    video_id: str | None = None
    question_timestamps: dict[str, list[int]] | None = None


class OutlineToolCompletePayload(BaseModel):
    success: bool
    outline_id: str
    trace_id: str
    message: str | None = None


class OutlineToolErrorPayload(BaseModel):
    success: bool
    message: str
    trace_id: str


async def outline_tool_complete(payload: OutlineToolCompletePayload, room: str) -> None:
    logger.info(
        f"[video_tool_outline_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, "
        f"outline_id={payload.outline_id}"
    )
    await sio.emit("outline_tool_complete", payload.model_dump(), room=room)
    logger.info(f"[video_tool_outline_complete] Emitted to room={room}")


async def outline_tool_error(payload: OutlineToolErrorPayload, room: str) -> None:
    await sio.emit("outline_tool_error", payload.model_dump(), room=room)


async def _video_tool_outline_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for outline creation."""
    logger.info(
        f"[video_tool_outline] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = OutlineToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in video_tool_outline for {sid}: {e}")
        await outline_tool_error(
            OutlineToolErrorPayload(
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
        await outline_tool_error(
            OutlineToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            video_id_uuid = (
                uuid.UUID(validated.video_id) if validated.video_id else None
            )

            # Save outline to database if videoId is provided
            outline_id: str | None = None
            if video_id_uuid:
                sql_create_outline = load_sql(
                    "sql/v3/videos/create_outline_for_video.sql"
                )
                sql_query = sql_create_outline
                # Note: run_id is not available here, so we pass None
                # The main outline handler will handle run_id linking
                sql_params = (
                    str(video_id_uuid),
                    validated.name,
                    validated.outline,
                    None,  # run_id - will be set by main handler if needed
                )

                outline_row = await conn.fetchrow(sql_create_outline, *sql_params)

                if outline_row:
                    outline_id = str(outline_row["outline_id"])
                    logger.info(
                        f"✓ Created outline {outline_id} and linked to video {validated.video_id}"
                    )
                else:
                    await outline_tool_error(
                        OutlineToolErrorPayload(
                            success=False,
                            message="Failed to create outline",
                            trace_id=trace_id,
                        ),
                        room=sid,
                    )
                    return

                # Save question timestamps if provided
                if validated.question_timestamps:
                    import json

                    timestamps_json = json.dumps(validated.question_timestamps)
                    sql_save_timestamps = load_sql(
                        "sql/v3/videos/save_question_timestamps.sql"
                    )
                    try:
                        await conn.execute(
                            sql_save_timestamps,
                            str(video_id_uuid),
                            timestamps_json,
                        )
                        logger.info(
                            f"✓ Saved question timestamps for video {validated.video_id}"
                        )
                    except Exception as e:
                        logger.warning(f"Failed to save question timestamps: {e}")

            if not outline_id:
                # If no video_id, we can't create outline in DB
                # But we still emit success for storage-based approach
                logger.info(
                    f"✓ Outline created (no video_id, using storage) "
                    f"(trace_id={trace_id})"
                )
                # Use a placeholder ID for storage-based approach
                outline_id = "storage-based"

            await outline_tool_complete(
                OutlineToolCompletePayload(
                    success=True,
                    outline_id=outline_id,
                    trace_id=trace_id,
                    message="Outline created successfully",
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(f"Error in video_tool_outline for {sid}: {str(e)}", exc_info=True)
        await outline_tool_error(
            OutlineToolErrorPayload(success=False, message=str(e), trace_id=trace_id),
            room=sid,
        )


@sio.event  # type: ignore
async def video_tool_outline(sid: str, data: dict[str, Any]) -> None:
    """Handle outline creation event from video outline generation tool (client-to-server)."""
    await _video_tool_outline_impl(sid, data)


@internal_sio.on("video_tool_outline")
async def video_tool_outline_internal(data: dict[str, Any]) -> None:
    """Handle outline creation event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        logger.error("[video_tool_outline_internal] Missing 'sid' in payload")
        return
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _video_tool_outline_impl(sid, payload)

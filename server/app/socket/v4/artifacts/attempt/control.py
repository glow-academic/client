"""Attempt control handlers for stop and end operations.

Handles WebSocket events for attempt control:
- attempt_stop: Stop message generation
- attempt_end: End current chat and move to next
- attempt_end_all: End all chats in an attempt

These handlers wrap existing simulation handlers with the unified attempt_* event contract.
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.cancel_active_run import cancel_active_run
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio
from app.socket.v4.artifacts.attempt.types import (
    AttemptChatEndedEvent,
    AttemptEndAllPayload,
    AttemptEndedEvent,
    AttemptEndPayload,
    AttemptStopPayload,
    AttemptStoppedEvent,
    AttemptUnifiedErrorEvent,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


async def _attempt_stop_impl(sid: str, data: AttemptStopPayload) -> None:
    """Handle attempt_stop - cancel active generation and mark message complete."""
    try:
        chat_id = str(data.chat_id)

        if not chat_id:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=None,
                    type="stop",
                    message="Missing chat_id",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        async with get_db_connection() as conn:
            # Try immediate in-process cancel first
            from app.infra.v4.websocket.cancel_active_result import cancel_active_result

            await cancel_active_result(chat_id)
            # Then set cooperative cancel flag (Redis)
            await cancel_active_run(chat_id)

            # Stop simulation and mark message complete using SQL
            sql = load_sql(
                "app/sql/v4/queries/simulations/simulation_text_stop_run_complete.sql"
            )
            row = await conn.fetchrow(sql, chat_id)

            if not row:
                result = {
                    "success": False,
                    "cancelled_message_id": None,
                    "final_content": "",
                }
            else:
                result = {
                    "success": row["success"],
                    "cancelled_message_id": row["cancelled_message_id"],
                    "final_content": row["final_content"],
                }

            if result["success"] and result["cancelled_message_id"]:
                # Emit attempt_stopped event
                await sio.emit(
                    "attempt_stopped",
                    AttemptStoppedEvent(
                        chat_id=chat_id,
                        success=True,
                        message=None,
                    ).model_dump(mode="json"),
                    room=sid,
                )
                # Also emit to attempt room for multi-tab sync
                await sio.emit(
                    "attempt_stopped",
                    AttemptStoppedEvent(
                        chat_id=chat_id,
                        success=True,
                        message=None,
                    ).model_dump(mode="json"),
                    room=f"attempt_{chat_id}",
                )

                # Log activity
                try:
                    await log_websocket_activity(
                        sid=sid,
                        event_key="attempt.stop.stopped",
                        template="{{ actor.name }} stopped attempt",
                        context={"chat_id": chat_id},
                        endpoint="/socket/v4/attempt/stop",
                        error=False,
                    )
                except Exception:
                    pass
            else:
                await sio.emit(
                    "attempt_stopped",
                    AttemptStoppedEvent(
                        chat_id=chat_id,
                        success=False,
                        message="No active message found for this chat",
                    ).model_dump(mode="json"),
                    room=sid,
                )

    except Exception as e:
        logger.exception(f"Error in attempt_stop: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=str(data.chat_id) if data else None,
                type="stop",
                message=f"Failed to stop: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_stop(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_stop event - stop message generation."""
    try:
        payload = AttemptStopPayload(**data)
        await _attempt_stop_impl(sid, payload)
    except Exception as e:
        logger.exception(f"Invalid request in attempt_stop: {str(e)}")
        chat_id = data.get("chat_id", "")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=str(chat_id) if chat_id else None,
                type="stop",
                message=f"Invalid request: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


async def _attempt_end_impl(
    sid: str, data: AttemptEndPayload, profile_id: uuid.UUID
) -> None:
    """Handle attempt_end - end specific chats with optional grade copying.

    Two modes:
    1. Single chat end: { attempt_id, chat_id } — marks one chat as completed
    2. Use Previous: { attempt_id, previous_chat_map } — creates skipped chats
       with copied grades from previous attempt
    """
    try:
        attempt_id = str(data.attempt_id)
        attempt_id_uuid = data.attempt_id

        if not data.chat_id and not data.previous_chat_map:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=None,
                    type="end",
                    message="Must provide chat_id or previous_chat_map",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        async with get_db_connection() as conn:
            last_chat_id: str | None = None

            # Mode 1: Single chat end (End Session with 0 messages)
            if data.chat_id:
                chat_id_uuid = data.chat_id
                chat_id = str(chat_id_uuid)

                # Verify chat exists and belongs to this attempt
                chat = await conn.fetchrow(
                    """
                    SELECT c.id, c.attempt_id
                    FROM simulation_chats_entry c
                    WHERE c.id = $1 AND c.attempt_id = $2 AND c.active = TRUE
                    """,
                    chat_id_uuid,
                    attempt_id_uuid,
                )
                if not chat:
                    await sio.emit(
                        "attempt_error",
                        AttemptUnifiedErrorEvent(
                            chat_id=chat_id,
                            type="end",
                            message="Chat not found",
                        ).model_dump(mode="json"),
                        room=sid,
                    )
                    return

                # Mark chat as completed
                await conn.execute(
                    """
                    INSERT INTO simulation_completions_entry (chat_id)
                    VALUES ($1)
                    ON CONFLICT (chat_id) DO NOTHING
                    """,
                    chat_id_uuid,
                )
                last_chat_id = chat_id

            # Mode 2: Use Previous — create skipped chats with copied grades
            if data.previous_chat_map:
                for scenario_id_str, prev_chat_id_str in data.previous_chat_map.items():
                    if not prev_chat_id_str:
                        continue
                    try:
                        prev_chat_uuid = uuid.UUID(prev_chat_id_str)
                        prev_scenario_uuid = uuid.UUID(scenario_id_str)

                        # Create a chat entry for the skipped scenario
                        skipped_chat_id = await conn.fetchval(
                            """
                            INSERT INTO simulation_chats_entry (attempt_id, active)
                            VALUES ($1, true)
                            RETURNING id
                            """,
                            attempt_id_uuid,
                        )
                        if not skipped_chat_id:
                            continue

                        # Link scenario to the skipped chat
                        await conn.execute(
                            """
                            INSERT INTO simulation_chats_scenarios_connection
                                (chat_id, scenarios_id, active)
                            VALUES ($1, $2, true)
                            ON CONFLICT DO NOTHING
                            """,
                            skipped_chat_id,
                            prev_scenario_uuid,
                        )

                        # Mark as completed
                        await conn.execute(
                            """
                            INSERT INTO simulation_completions_entry (chat_id)
                            VALUES ($1)
                            ON CONFLICT (chat_id) DO NOTHING
                            """,
                            skipped_chat_id,
                        )

                        # Copy grade from previous chat
                        await conn.execute(
                            """
                            INSERT INTO simulation_grades_entry (
                                chat_id, run_id, rubric_grade_agent_id, rubric_id,
                                score, passed, time_taken, total_points, pass_points,
                                generated, active
                            )
                            SELECT $2, g.run_id, g.rubric_grade_agent_id, g.rubric_id,
                                   g.score, g.passed, g.time_taken, g.total_points, g.pass_points,
                                   g.generated, true
                            FROM simulation_grades_entry g
                            WHERE g.chat_id = $1 AND g.active = true
                            ORDER BY g.created_at DESC
                            LIMIT 1
                            """,
                            prev_chat_uuid,
                            skipped_chat_id,
                        )

                        # Copy feedbacks from previous chat
                        await conn.execute(
                            """
                            INSERT INTO simulation_feedbacks_entry (
                                chat_id, standard_id, total, feedback, active
                            )
                            SELECT $2, f.standard_id, f.total, f.feedback, true
                            FROM simulation_feedbacks_entry f
                            WHERE f.chat_id = $1 AND f.active = true
                            """,
                            prev_chat_uuid,
                            skipped_chat_id,
                        )

                        last_chat_id = str(skipped_chat_id)

                    except Exception as e:
                        logger.warning(
                            f"Failed to create skipped chat for scenario "
                            f"{scenario_id_str}: {e}"
                        )
                        continue

            # Refresh MVs so changes are immediately visible
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_list")
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_chats")

            # Emit attempt_chat_ended event
            event = AttemptChatEndedEvent(
                chat_id=last_chat_id or "",
                is_attempt_finished=None,
                grade_id=None,
            )
            await sio.emit(
                "attempt_chat_ended",
                event.model_dump(mode="json"),
                room=sid,
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="attempt.end.ended",
                    template="{{ actor.name }} ended chat",
                    context={"attempt_id": attempt_id},
                    endpoint="/socket/v4/attempt/end",
                    error=False,
                )
            except Exception:
                pass

    except Exception as e:
        logger.exception(f"Error in attempt_end: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=None,
                type="end",
                message=f"Failed to end chat: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_end(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_end event - end specific chats or use previous grades."""
    try:
        payload = AttemptEndPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=None,
                    type="end",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _attempt_end_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_end: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=None,
                type="end",
                message=f"Invalid request: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


async def _attempt_end_all_impl(sid: str, data: AttemptEndAllPayload) -> None:
    """Handle attempt_end_all - end all remaining chats and create stubs for missing scenarios."""
    try:
        attempt_id = str(data.attempt_id)
        attempt_id_uuid = data.attempt_id

        async with get_db_connection() as conn:
            # Get all existing chats for this attempt
            existing_chats = await conn.fetch(
                """
                SELECT c.id
                FROM simulation_chats_entry c
                WHERE c.attempt_id = $1 AND c.active = TRUE
                """,
                attempt_id_uuid,
            )

            # Mark all existing incomplete chats as completed
            for chat in existing_chats:
                await conn.execute(
                    """
                    INSERT INTO simulation_completions_entry (chat_id)
                    VALUES ($1)
                    ON CONFLICT (chat_id) DO NOTHING
                    """,
                    chat["id"],
                )

            # Find expected scenarios for this attempt's simulation
            expected_scenarios = await conn.fetch(
                """
                SELECT DISTINCT ss.scenario_id
                FROM simulation_scenarios_junction ss
                JOIN simulation_simulations_junction ssj ON ssj.simulation_id = ss.simulation_id
                    AND ssj.active = true
                JOIN training_entry t ON t.simulations_id = ssj.simulations_id
                    AND t.active = true
                JOIN simulation_attempts_entry a ON a.training_id = t.id
                WHERE a.id = $1 AND ss.active = true
                """,
                attempt_id_uuid,
            )

            # Get existing chat scenario IDs from MV
            existing_scenario_rows = await conn.fetch(
                """
                SELECT DISTINCT scenario_id
                FROM mv_attempt_chats
                WHERE attempt_id = $1 AND scenario_id IS NOT NULL
                """,
                attempt_id_uuid,
            )
            existing_scenario_ids = {
                row["scenario_id"] for row in existing_scenario_rows
            }

            # Create stub chats for missing scenarios
            for scenario_row in expected_scenarios:
                scenario_id = scenario_row["scenario_id"]
                if scenario_id in existing_scenario_ids:
                    continue

                try:
                    # Create stub chat
                    stub_chat_id = await conn.fetchval(
                        """
                        INSERT INTO simulation_chats_entry (attempt_id, active)
                        VALUES ($1, true)
                        RETURNING id
                        """,
                        attempt_id_uuid,
                    )
                    if not stub_chat_id:
                        continue

                    # Link scenario to stub chat
                    await conn.execute(
                        """
                        INSERT INTO simulation_chats_scenarios_connection
                            (chat_id, scenarios_id, active)
                        VALUES ($1, $2, true)
                        ON CONFLICT DO NOTHING
                        """,
                        stub_chat_id,
                        scenario_id,
                    )

                    # Mark as completed
                    await conn.execute(
                        """
                        INSERT INTO simulation_completions_entry (chat_id)
                        VALUES ($1)
                        ON CONFLICT (chat_id) DO NOTHING
                        """,
                        stub_chat_id,
                    )
                except Exception as e:
                    logger.warning(
                        f"Failed to create stub chat for scenario {scenario_id}: {e}"
                    )
                    continue

            # Refresh MVs
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_list")
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_chats")

            # Emit attempt_ended event
            event = AttemptEndedEvent(
                attempt_id=attempt_id,
                success=True,
                message="All chats ended",
            )
            await sio.emit(
                "attempt_ended",
                event.model_dump(mode="json"),
                room=sid,
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="attempt.end_all.ended",
                    template="{{ actor.name }} ended all chats",
                    context={"attempt_id": attempt_id},
                    endpoint="/socket/v4/attempt/end_all",
                    error=False,
                )
            except Exception:
                pass

    except Exception as e:
        logger.exception(f"Error in attempt_end_all: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=None,
                type="end",
                message=f"Failed to end all chats: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_end_all(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_end_all event - end all chats in an attempt."""
    try:
        payload = AttemptEndAllPayload(**data)
        await _attempt_end_all_impl(sid, payload)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_end_all: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=None,
                type="end",
                message=f"Invalid request: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/stop", response_model=dict[str, bool])
async def attempt_stop_api(request: AttemptStopPayload) -> dict[str, bool]:
    """Client-to-server event: Stop message generation."""
    return {"success": True}


@client_router.post("/attempt/end", response_model=dict[str, bool])
async def attempt_end_api(request: AttemptEndPayload) -> dict[str, bool]:
    """Client-to-server event: End current chat."""
    return {"success": True}


@client_router.post("/attempt/end_all", response_model=dict[str, bool])
async def attempt_end_all_api(request: AttemptEndAllPayload) -> dict[str, bool]:
    """Client-to-server event: End all chats in an attempt."""
    return {"success": True}


@server_router.post("/attempt/stopped", response_model=dict[str, bool])
async def attempt_stopped_api(request: AttemptStoppedEvent) -> dict[str, bool]:
    """Server-to-client event: Message generation stopped."""
    return {"success": True}


@server_router.post("/attempt/chat_ended", response_model=dict[str, bool])
async def attempt_chat_ended_api(request: AttemptChatEndedEvent) -> dict[str, bool]:
    """Server-to-client event: Chat ended."""
    return {"success": True}


@server_router.post("/attempt/ended", response_model=dict[str, bool])
async def attempt_ended_api(request: AttemptEndedEvent) -> dict[str, bool]:
    """Server-to-client event: All chats ended."""
    return {"success": True}

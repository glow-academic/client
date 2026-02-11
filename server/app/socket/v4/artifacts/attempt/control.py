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
    """Handle attempt_end - end current chat and transition to next.

    This is a simplified version that delegates to the simulation_text_end handler
    by emitting the appropriate internal event, then translates the response.
    """
    try:
        chat_id = str(data.chat_id)

        if not chat_id:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=None,
                    type="end",
                    message="Missing chat_id",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        async with get_db_connection() as conn:
            chat_id_uuid = uuid.UUID(chat_id)

            # Get the chat and attempt_id using inline query
            chat_sql = """
                SELECT c.id, c.attempt_id
                FROM simulation_chats_entry c
                WHERE c.id = $1 AND c.active = TRUE
            """
            chat = await conn.fetchrow(chat_sql, chat_id_uuid)
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

            attempt_id = str(chat["attempt_id"])

            # Mark chat as completed by inserting into completions_entry
            insert_completion_sql = """
                INSERT INTO simulation_completions_entry (chat_id)
                VALUES ($1)
                ON CONFLICT (chat_id) DO NOTHING
            """
            await conn.execute(insert_completion_sql, chat_id_uuid)

            # Copy grade from previous chat if provided (Use Previous flow)
            if data.previous_chat_id:
                copy_grade_sql = """
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
                """
                prev_chat_uuid = uuid.UUID(str(data.previous_chat_id))
                await conn.execute(copy_grade_sql, prev_chat_uuid, chat_id_uuid)

            # Create end_conversation call entry
            end_conv_sql = """
                WITH last_run AS (
                    SELECT me.run_id
                    FROM simulation_messages_entry sm
                    JOIN messages_entry me ON me.id = sm.id
                    WHERE sm.chat_id = $1 AND me.run_id IS NOT NULL
                    ORDER BY me.created_at DESC
                    LIMIT 1
                ),
                new_call AS (
                    INSERT INTO calls_entry (external_call_id, run_id, arguments_raw, completed)
                    SELECT
                        $2,
                        lr.run_id,
                        $3,
                        true
                    FROM last_run lr
                    RETURNING id
                )
                INSERT INTO tool_calls_junction (tool_id, call_id)
                SELECT '019b484d-9837-760c-aa73-2421c6d107c0'::uuid, nc.id
                FROM new_call nc
            """
            end_conv_call_id = str(uuid.uuid4())
            await conn.execute(
                end_conv_sql,
                chat_id_uuid,
                end_conv_call_id,
                '{"end_reason":"user_ended"}',
            )

            # Check for next incomplete scenario
            sql = load_sql(
                "app/sql/v4/queries/simulations/check_next_incomplete_scenario_complete.sql"
            )
            next_scenario_row = await conn.fetchrow(sql, uuid.UUID(attempt_id))

            next_chat_id = None
            is_attempt_finished = True

            if next_scenario_row and next_scenario_row.get("has_next_scenario"):
                is_attempt_finished = False

            # Emit attempt_chat_ended event
            event = AttemptChatEndedEvent(
                chat_id=chat_id,
                next_chat_id=next_chat_id,
                is_attempt_finished=is_attempt_finished,
                grade_id=None,
            )
            await sio.emit(
                "attempt_chat_ended",
                event.model_dump(mode="json"),
                room=sid,
            )
            # Also emit to attempt room
            await sio.emit(
                "attempt_chat_ended",
                event.model_dump(mode="json"),
                room=f"attempt_{chat_id}",
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="attempt.end.ended",
                    template="{{ actor.name }} ended chat",
                    context={"chat_id": chat_id},
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
                chat_id=str(data.chat_id) if data else None,
                type="end",
                message=f"Failed to end chat: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_end(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_end event - end current chat."""
    try:
        payload = AttemptEndPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=str(payload.chat_id),
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
        chat_id = data.get("chat_id", "")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=str(chat_id) if chat_id else None,
                type="end",
                message=f"Invalid request: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


async def _attempt_end_all_impl(sid: str, data: AttemptEndAllPayload) -> None:
    """Handle attempt_end_all - end all chats in an attempt."""
    try:
        attempt_id = str(data.attempt_id)

        if not attempt_id:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=None,
                    type="end",
                    message="Missing attempt_id",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        async with get_db_connection() as conn:
            attempt_id_uuid = uuid.UUID(attempt_id)

            # Get all chats for this attempt using inline query
            get_chats_sql = """
                SELECT c.id
                FROM simulation_chats_entry c
                WHERE c.attempt_id = $1 AND c.active = TRUE
            """
            chats = await conn.fetch(get_chats_sql, attempt_id_uuid)

            if not chats:
                await sio.emit(
                    "attempt_error",
                    AttemptUnifiedErrorEvent(
                        chat_id=None,
                        type="end",
                        message="No chats found for this attempt",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            # Mark all incomplete chats as completed by inserting into completions_entry
            insert_completion_sql = """
                INSERT INTO simulation_completions_entry (chat_id)
                VALUES ($1)
                ON CONFLICT (chat_id) DO NOTHING
            """
            end_conv_sql = """
                WITH last_run AS (
                    SELECT me.run_id
                    FROM simulation_messages_entry sm
                    JOIN messages_entry me ON me.id = sm.id
                    WHERE sm.chat_id = $1 AND me.run_id IS NOT NULL
                    ORDER BY me.created_at DESC
                    LIMIT 1
                ),
                new_call AS (
                    INSERT INTO calls_entry (external_call_id, run_id, arguments_raw, completed)
                    SELECT
                        $2,
                        lr.run_id,
                        $3,
                        true
                    FROM last_run lr
                    RETURNING id
                )
                INSERT INTO tool_calls_junction (tool_id, call_id)
                SELECT '019b484d-9837-760c-aa73-2421c6d107c0'::uuid, nc.id
                FROM new_call nc
            """
            for chat in chats:
                await conn.execute(insert_completion_sql, chat["id"])
                await conn.execute(
                    end_conv_sql,
                    chat["id"],
                    str(uuid.uuid4()),
                    '{"end_reason":"user_ended_all"}',
                )

            # Copy grades from previous chats if provided (Use Previous flow)
            if data.previous_chat_map:
                copy_grade_sql = """
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
                """
                find_chat_sql = """
                    SELECT c.id
                    FROM simulation_chats_entry c
                    JOIN mv_attempt_chats msc ON msc.chat_id = c.id
                    JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = msc.scenario_id
                    WHERE c.attempt_id = $1 AND ssj.scenario_id = $2 AND c.active = TRUE
                    LIMIT 1
                """
                for scenario_id_str, prev_chat_id_str in data.previous_chat_map.items():
                    if prev_chat_id_str:
                        try:
                            chat_row = await conn.fetchrow(
                                find_chat_sql,
                                attempt_id_uuid,
                                uuid.UUID(scenario_id_str),
                            )
                            if chat_row:
                                await conn.execute(
                                    copy_grade_sql,
                                    uuid.UUID(prev_chat_id_str),
                                    chat_row["id"],
                                )
                        except Exception as e:
                            logger.warning(
                                f"Failed to copy grade for scenario {scenario_id_str}: {e}"
                            )

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

"""Attempt end handler.

Handles WebSocket events for ending chats:
- attempt_end: End current chat and move to next
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.socket.v4.artifacts.attempt.types import (
    AttemptChatEndedEvent,
    AttemptEndPayload,
    AttemptUnifiedErrorEvent,
)
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


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


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/end", response_model=dict[str, bool])
async def attempt_end_api(request: AttemptEndPayload) -> dict[str, bool]:
    """Client-to-server event: End current chat."""
    return {"success": True}


@server_router.post("/attempt/chat_ended", response_model=dict[str, bool])
async def attempt_chat_ended_api(request: AttemptChatEndedEvent) -> dict[str, bool]:
    """Server-to-client event: Chat ended."""
    return {"success": True}

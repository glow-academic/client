"""Attempt end all handler.

Handles WebSocket events for ending all chats:
- attempt_end_all: End all chats in an attempt
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.attempt.types import (
    AttemptEndAllPayload,
    AttemptEndedEvent,
    AttemptUnifiedErrorEvent,
)
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


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


@client_router.post("/attempt/end_all", response_model=dict[str, bool])
async def attempt_end_all_api(request: AttemptEndAllPayload) -> dict[str, bool]:
    """Client-to-server event: End all chats in an attempt."""
    return {"success": True}


@server_router.post("/attempt/ended", response_model=dict[str, bool])
async def attempt_ended_api(request: AttemptEndedEvent) -> dict[str, bool]:
    """Server-to-client event: All chats ended."""
    return {"success": True}

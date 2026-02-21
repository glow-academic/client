"""Attempt start handler.

Handles: attempt_start — create a new attempt or proceed to the next scenario.

Dual-mode:
- Create mode (no attempt_id): resolve context, create attempt, emit attempt_started,
  then compose with generate.py to kick off the first chat.
- Next mode (has attempt_id): check remaining scenarios. If more remain, compose with
  generate.py for the next chat. If all complete, emit attempt_ended.
"""

import uuid
from typing import Any

from app.api.v4.entries.attempt.create import create_attempt_with_context_internal
from app.api.v4.entries.attempt.get import get_attempt_entries_internal
from app.api.v4.resources.training.context import get_training_attempt_context_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio
from app.socket.v5.client.generate import _generate_impl
from app.socket.v5.client.types import (
    AttemptEndedEvent,
    AttemptErrorEvent,
    AttemptStartedEvent,
    AttemptStartPayload,
    GeneratePayload,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

# SQL to count remaining scenarios (expected from training - completed chats)
SQL_REMAINING_SCENARIOS = """
    WITH attempt_training AS (
        SELECT COALESCE(pte.training_id, hte.training_id) AS training_id
        FROM attempt_entry a
        LEFT JOIN attempt_practice_entry apc ON apc.attempt_id = a.id AND apc.active = true
        LEFT JOIN practice_training_entry pte ON pte.practice_id = apc.practice_id AND pte.active = true
        LEFT JOIN attempt_home_entry ahc ON ahc.attempt_id = a.id AND ahc.active = true
        LEFT JOIN home_training_entry hte ON hte.home_id = ahc.home_id AND hte.active = true
        WHERE a.id = $1
    ),
    expected_scenarios AS (
        SELECT DISTINCT tsc.scenarios_id AS scenario_id
        FROM attempt_training at2
        JOIN training_scenarios_connection tsc ON tsc.training_id = at2.training_id AND tsc.active = true
    ),
    completed_chats AS (
        SELECT COUNT(*) AS cnt
        FROM attempt_chat_entry c
        WHERE c.attempt_id = $1 AND c.active = true
    )
    SELECT
        (SELECT COUNT(*) FROM expected_scenarios)::int AS total_scenarios,
        (SELECT cnt FROM completed_chats)::int AS completed_scenarios,
        (GREATEST((SELECT COUNT(*) FROM expected_scenarios) - (SELECT cnt FROM completed_chats), 0))::int AS remaining_scenarios
"""


async def _compose_chat_generate(
    sid: str,
    profile_id: uuid.UUID,
    attempt_id: uuid.UUID,
    training_entry_id: uuid.UUID,
    chat_resolved_id: uuid.UUID,
    payload: AttemptStartPayload,
) -> None:
    """Compose with the unified generate handler to start a chat generation."""
    resource_types = payload.resource_types or [
        "personas",
        "scenarios",
        "parameters",
        "fields",
    ]

    generate_payload = GeneratePayload(
        artifact_type="chat",
        artifact_id=training_entry_id,
        draft_id=payload.draft_id,
        resource_types=resource_types,
        user_instructions=payload.user_instructions,
        save=payload.save,
        attempt_id=str(attempt_id),
        chat_resolved_id=str(chat_resolved_id),
    )

    await _generate_impl(sid, generate_payload, profile_id)


async def _attempt_start_impl(
    sid: str, payload: AttemptStartPayload, profile_id: uuid.UUID
) -> None:
    """Handle attempt_start — create or proceed to next scenario."""
    try:
        if payload.attempt_id is None:
            # === CREATE MODE ===
            if not payload.training_entry_id:
                await sio.emit(
                    "attempt_error",
                    AttemptErrorEvent(
                        type="start",
                        message="training_entry_id is required to create an attempt",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            # Step 1: Resolve training context (cached)
            async with get_db_connection() as conn:
                ctx = await get_training_attempt_context_internal(
                    conn, profile_id, payload.training_entry_id
                )

            # Step 2: Create attempt with pre-resolved context
            async with get_db_connection() as conn:
                attempt_id = await create_attempt_with_context_internal(
                    conn, context=ctx, infinite_mode=payload.infinite_mode
                )

            # Emit attempt_started to client
            await sio.emit(
                "attempt_started",
                AttemptStartedEvent(
                    attempt_id=str(attempt_id),
                    training_entry_id=str(payload.training_entry_id),
                ).model_dump(mode="json"),
                room=sid,
            )

            # Step 3: GET from MV for training context
            async with get_db_connection() as conn:
                items = await get_attempt_entries_internal(
                    conn, [attempt_id], bypass_cache=True
                )

            if not items or not items[0].get("chat_resolved_id"):
                logger.warning(f"No training context in MV for attempt {attempt_id}")
                return

            await _compose_chat_generate(
                sid=sid,
                profile_id=profile_id,
                attempt_id=attempt_id,
                training_entry_id=payload.training_entry_id,
                chat_resolved_id=uuid.UUID(
                    str(items[0]["chat_resolved_id"])
                ),
                payload=payload,
            )

        else:
            # === NEXT MODE ===
            attempt_id = payload.attempt_id

            # GET from MV for training context
            async with get_db_connection() as conn:
                items = await get_attempt_entries_internal(
                    conn, [attempt_id], bypass_cache=True
                )

            if not items or not items[0].get("training_entry_id"):
                logger.warning(f"No training context in MV for attempt {attempt_id}")
                await sio.emit(
                    "attempt_error",
                    AttemptErrorEvent(
                        type="start",
                        message="Attempt context not found",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            attempt_data = items[0]
            training_entry_id = uuid.UUID(str(attempt_data["training_entry_id"]))
            chat_resolved_id = uuid.UUID(
                str(attempt_data["chat_resolved_id"])
            )

            # Check remaining scenarios
            async with get_db_connection() as conn:
                remaining = await conn.fetchrow(SQL_REMAINING_SCENARIOS, attempt_id)

            remaining_count = remaining["remaining_scenarios"] if remaining else 0

            if remaining_count > 0:
                # More scenarios to go — compose with generate
                await _compose_chat_generate(
                    sid=sid,
                    profile_id=profile_id,
                    attempt_id=attempt_id,
                    training_entry_id=training_entry_id,
                    chat_resolved_id=chat_resolved_id,
                    payload=payload,
                )
            else:
                # All scenarios complete — emit attempt_ended
                await sio.emit(
                    "attempt_ended",
                    AttemptEndedEvent(
                        attempt_id=str(attempt_id),
                        success=True,
                        all_scenarios_complete=True,
                        message="All scenarios completed",
                    ).model_dump(mode="json"),
                    room=sid,
                )

    except Exception as e:
        logger.exception(f"Error in attempt_start: {e}")
        await sio.emit(
            "attempt_error",
            AttemptErrorEvent(
                type="start",
                message=f"Failed to start attempt: {e}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_start(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_start event from client."""
    try:
        payload = AttemptStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptErrorEvent(
                    type="start",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _attempt_start_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_start: {e}")
        await sio.emit(
            "attempt_error",
            AttemptErrorEvent(
                type="start",
                message=f"Invalid request: {e}",
            ).model_dump(mode="json"),
            room=sid,
        )



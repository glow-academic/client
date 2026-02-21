"""Internal attempt_start handler — creates a new attempt and kicks off first chat.

Handles: @internal_sio.on("attempt_start")

Create-only: resolve context, create attempt, emit attempt_started,
then emit "generate" to kick off the first chat.
Next-scenario logic is handled by attempt_next.
"""

import uuid
from typing import Any

from app.api.v4.entries.attempt.create import create_attempt_with_context_internal
from app.api.v4.entries.attempt.get import get_attempt_entries_internal
from app.api.v4.resources.training.context import get_training_attempt_context_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.client.types import AttemptNextPayload, AttemptStartPayload
from app.socket.v5.internal.attempt.types import (
    AttemptErrorData,
    AttemptStartedData,
    GenerateRequestData,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

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


async def _emit_chat_generate(
    sid: str,
    profile_id: uuid.UUID,
    attempt_id: uuid.UUID,
    training_entry_id: uuid.UUID,
    chat_resolved_id: uuid.UUID,
    payload: AttemptStartPayload | AttemptNextPayload,
) -> None:
    """Compose with generate by emitting to the internal bus."""
    resource_types = payload.resource_types or [
        "personas",
        "scenarios",
        "parameters",
        "fields",
    ]

    await internal_sio.emit(
        "generate",
        GenerateRequestData(
            sid=sid,
            profile_id=str(profile_id),
            artifact_type="chat",
            artifact_id=str(training_entry_id),
            draft_id=str(payload.draft_id)
            if getattr(payload, "draft_id", None)
            else None,
            resource_types=resource_types,
            user_instructions=payload.user_instructions,
            save=payload.save,
            attempt_id=str(attempt_id),
            chat_resolved_id=str(chat_resolved_id),
        ).model_dump(mode="json"),
    )


@internal_sio.on("attempt_start")  # type: ignore
async def attempt_start_handler(data: dict[str, Any]) -> None:
    """Handle attempt_start — create a new attempt."""
    sid = data.get("sid", "")
    if not sid:
        return

    # Resolve profile_id (passed from client, or fallback to socket lookup)
    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        payload = AttemptStartPayload(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_start payload: {e}")
        return

    try:
        # === CREATE MODE ===
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

        # Emit attempt_started to client via server layer
        await internal_sio.emit(
            "attempt_started",
            AttemptStartedData(
                sid=sid,
                attempt_id=str(attempt_id),
                training_entry_id=str(payload.training_entry_id),
            ).model_dump(mode="json"),
        )

        # Step 3: GET from MV for training context
        async with get_db_connection() as conn:
            items = await get_attempt_entries_internal(
                conn, [attempt_id], bypass_cache=True
            )

        if not items or not items[0].get("chat_resolved_id"):
            logger.warning(f"No training context in MV for attempt {attempt_id}")
            return

        await _emit_chat_generate(
            sid=sid,
            profile_id=profile_id,
            attempt_id=attempt_id,
            training_entry_id=payload.training_entry_id,
            chat_resolved_id=uuid.UUID(str(items[0]["chat_resolved_id"])),
            payload=payload,
        )

    except Exception as e:
        logger.exception(f"Error in attempt_start: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="start",
                message=f"Failed to start attempt: {e}",
            ).model_dump(mode="json"),
        )

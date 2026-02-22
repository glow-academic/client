"""Internal attempt_next handler — next-scenario logic for existing attempts.

Handles: @internal_sio.on("attempt_next")

Flow:
1. Read MV for chat_entry_id + department_id
2. Check remaining scenarios
3. If none remain → emit attempt_ended
4. Call prepare_training_start (creates/reuses chat_resolved_entry)
5. Check needs_generation
6. If ready → link attempt_chat_entry, emit attempt_chat_started
7. If needs generation → emit generate (save=True), generation_complete handles linking
"""

import uuid
from typing import Any

from app.api.v4.entries.attempt.get import get_attempt_entries_internal
from app.api.v4.resources.training.context import (
    check_resolved_needs_generation,
    prepare_training_start_internal,
)
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.client.types import AttemptNextPayload
from app.socket.v5.internal.attempt.start import (
    SQL_REMAINING_SCENARIOS,
    _emit_chat_generate,
    _link_attempt_chat,
)
from app.socket.v5.internal.attempt.types import (
    AttemptChatStartedData,
    AttemptEndedData,
    AttemptErrorData,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_next")  # type: ignore
async def attempt_next_handler(data: dict[str, Any]) -> None:
    """Handle attempt_next — proceed to next scenario in existing attempt."""
    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        payload = AttemptNextPayload(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_next payload: {e}")
        return

    try:
        attempt_id = payload.attempt_id

        # Step 1: GET from MV for chat_entry_id + department_id
        async with get_db_connection() as conn:
            items = await get_attempt_entries_internal(
                conn, [attempt_id], bypass_cache=True
            )

        if not items or not items[0].get("chat_entry_id"):
            logger.warning(f"No training context in MV for attempt {attempt_id}")
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="next",
                    message="Attempt context not found",
                ).model_dump(mode="json"),
            )
            return

        attempt_data = items[0]
        chat_entry_id = uuid.UUID(str(attempt_data["chat_entry_id"]))
        department_id_str = attempt_data.get("department_id")

        if not department_id_str:
            logger.warning(f"No department_id in MV for attempt {attempt_id}")
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="next",
                    message="Department context not found",
                ).model_dump(mode="json"),
            )
            return

        department_id = uuid.UUID(str(department_id_str))

        # Step 2: Check remaining scenarios
        async with get_db_connection() as conn:
            remaining = await conn.fetchrow(SQL_REMAINING_SCENARIOS, attempt_id)

        remaining_count = remaining["remaining_scenarios"] if remaining else 0

        if remaining_count <= 0:
            # All scenarios complete — emit attempt_ended
            await internal_sio.emit(
                "attempt_ended",
                AttemptEndedData(
                    sid=sid,
                    attempt_id=str(attempt_id),
                    success=True,
                    all_scenarios_complete=True,
                    message="All scenarios completed",
                ).model_dump(mode="json"),
            )
            return

        # Step 3: Call prepare_training_start (create/reuse resolved entry)
        async with get_db_connection() as conn:
            chat_resolved_id, scenario_id = await prepare_training_start_internal(
                conn,
                profile_id=profile_id,
                chat_entry_id=chat_entry_id,
                department_id=department_id,
                draft_id=payload.draft_id,
            )

        if not chat_resolved_id:
            logger.warning(
                f"prepare_training_start returned no chat_resolved_id for attempt_next {attempt_id}"
            )
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="next",
                    message="Failed to resolve training context",
                ).model_dump(mode="json"),
            )
            return

        # Step 4: Check if resolved entry needs generation
        async with get_db_connection() as conn:
            needs_generation = await check_resolved_needs_generation(
                conn, chat_resolved_id
            )

        if not needs_generation:
            # Resources already populated — link and proceed
            async with get_db_connection() as conn:
                chat_id = await _link_attempt_chat(
                    conn, profile_id, attempt_id, chat_resolved_id
                )

            if chat_id:
                await internal_sio.emit(
                    "attempt_chat_started",
                    AttemptChatStartedData(
                        sid=sid,
                        attempt_id=str(attempt_id),
                        chat_id=str(chat_id),
                    ).model_dump(mode="json"),
                )
        else:
            # Needs generation — always auto-generate on attempt_next (user pressed "Next")
            await _emit_chat_generate(
                sid=sid,
                profile_id=profile_id,
                attempt_id=attempt_id,
                chat_entry_id=chat_entry_id,
                department_id=department_id,
                chat_resolved_id=chat_resolved_id,
            )

    except Exception as e:
        logger.exception(f"Error in attempt_next: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="next",
                message=f"Failed to continue attempt: {e}",
            ).model_dump(mode="json"),
        )

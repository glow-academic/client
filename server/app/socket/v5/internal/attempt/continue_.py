"""Internal attempt_continue handler — next-scenario logic for existing attempts.

Handles: @internal_sio.on("attempt_continue")

Checks remaining scenarios in the attempt. If more remain, emits "generate"
for the next chat. If all complete, emits attempt_ended.
"""

import uuid
from typing import Any

from app.api.v4.entries.attempt.get import get_attempt_entries_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.client.types import AttemptContinuePayload
from app.socket.v5.internal.attempt.start import (
    SQL_REMAINING_SCENARIOS,
    _emit_chat_generate,
)
from app.socket.v5.internal.attempt.types import (
    AttemptEndedData,
    AttemptErrorData,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_continue")  # type: ignore
async def attempt_continue_handler(data: dict[str, Any]) -> None:
    """Handle attempt_continue — proceed to next scenario in existing attempt."""
    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        payload = AttemptContinuePayload(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_continue payload: {e}")
        return

    try:
        attempt_id = payload.attempt_id

        # GET from MV for training context
        async with get_db_connection() as conn:
            items = await get_attempt_entries_internal(
                conn, [attempt_id], bypass_cache=True
            )

        if not items or not items[0].get("training_entry_id"):
            logger.warning(f"No training context in MV for attempt {attempt_id}")
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="continue",
                    message="Attempt context not found",
                ).model_dump(mode="json"),
            )
            return

        attempt_data = items[0]
        training_entry_id = uuid.UUID(str(attempt_data["training_entry_id"]))
        chat_resolved_id = uuid.UUID(str(attempt_data["chat_resolved_id"]))

        # Check remaining scenarios
        async with get_db_connection() as conn:
            remaining = await conn.fetchrow(SQL_REMAINING_SCENARIOS, attempt_id)

        remaining_count = remaining["remaining_scenarios"] if remaining else 0

        if remaining_count > 0:
            await _emit_chat_generate(
                sid=sid,
                profile_id=profile_id,
                attempt_id=attempt_id,
                training_entry_id=training_entry_id,
                chat_resolved_id=chat_resolved_id,
                payload=payload,
            )
        else:
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

    except Exception as e:
        logger.exception(f"Error in attempt_continue: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="continue",
                message=f"Failed to continue attempt: {e}",
            ).model_dump(mode="json"),
        )

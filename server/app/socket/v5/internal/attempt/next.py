"""Internal attempt_next handler — resolve context for next scenario, then delegate.

Handles: @internal_sio.on("attempt_next")

Flow:
1. Read MV for chat_entry_id + department_id
2. Check remaining scenarios (if 0 → attempt_ended)
3. Emit attempt_proceed with force_proceed=True
"""

import uuid
from typing import Any

from app.api.v4.entries.attempt.get import get_attempt_entries_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.client.types import AttemptNextPayload
from app.socket.v5.internal.attempt.start import SQL_REMAINING_SCENARIOS
from app.socket.v5.internal.attempt.types import (
    AttemptEndedData,
    AttemptErrorData,
    AttemptProceedData,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_next")  # type: ignore
async def attempt_next_handler(data: dict[str, Any]) -> None:
    """Handle attempt_next — resolve context, then emit attempt_proceed."""
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

        # Step 1: Read MV for chat_entry_id + department_id
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
        chat_entry_id = str(attempt_data["chat_entry_id"])
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

        # Step 2: Check remaining scenarios
        async with get_db_connection() as conn:
            remaining = await conn.fetchrow(SQL_REMAINING_SCENARIOS, attempt_id)

        remaining_count = remaining["remaining_scenarios"] if remaining else 0

        if remaining_count <= 0:
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

        # Step 3: Delegate to attempt_proceed
        await internal_sio.emit(
            "attempt_proceed",
            AttemptProceedData(
                sid=sid,
                profile_id=str(profile_id),
                attempt_id=str(attempt_id),
                chat_entry_id=chat_entry_id,
                department_id=str(department_id_str),
                draft_id=str(payload.draft_id) if payload.draft_id else None,
                force_proceed=True,
            ).model_dump(mode="json"),
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

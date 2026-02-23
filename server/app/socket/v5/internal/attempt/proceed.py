"""Internal attempt_proceed handler — shared core logic for starting a chat scenario.

Handles: @internal_sio.on("attempt_proceed")

Both attempt_start and attempt_next resolve context, then emit attempt_proceed.
This handler owns the prepare → check → link/generate flow:

1. prepare_training_start (creates/reuses chat_resolved_entry)
2. check_resolved_needs_generation
3. If ready → link attempt_chat_entry, emit attempt_chat_started
4. If needs generation + should_proceed → _emit_chat_generate
5. If needs generation + !should_proceed → emit attempt_started (lobby)
"""

from __future__ import annotations

import uuid
from typing import Any

from app.api.v4.resources.training.context import (
    check_resolved_needs_generation,
    prepare_training_start_internal,
)
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.internal.attempt.start import (
    _emit_chat_generate,
    _link_attempt_chat,
)
from app.socket.v5.internal.attempt.types import (
    AttemptChatStartedData,
    AttemptErrorData,
    AttemptProceedData,
    AttemptStartedData,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

# Will be replaced with real logic (e.g. check training config flags)
SHOULD_PROCEED = False


@internal_sio.on("attempt_proceed")  # type: ignore
async def attempt_proceed_handler(data: dict[str, Any]) -> None:
    """Shared core: prepare → check → link or generate."""
    sid = data.get("sid", "")
    if not sid:
        return

    try:
        payload = AttemptProceedData(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_proceed payload: {e}")
        return

    try:
        profile_id = uuid.UUID(payload.profile_id)
        attempt_id = uuid.UUID(payload.attempt_id)
        chat_entry_id = uuid.UUID(payload.chat_entry_id)
        department_id = uuid.UUID(payload.department_id)
        draft_id = uuid.UUID(payload.draft_id) if payload.draft_id else None

        should_proceed = payload.force_proceed or SHOULD_PROCEED

        # Step 1: prepare_training_start (creates/reuses chat_resolved_entry)
        async with get_db_connection() as conn:
            chat_resolved_id, scenario_id = await prepare_training_start_internal(
                conn,
                profile_id=profile_id,
                chat_entry_id=chat_entry_id,
                department_id=department_id,
                draft_id=draft_id,
            )

        if not chat_resolved_id:
            logger.warning(
                f"prepare_training_start returned no chat_resolved_id for attempt {attempt_id}"
            )
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="proceed",
                    message="Failed to resolve training context",
                ).model_dump(mode="json"),
            )
            return

        # Step 2: Check if resolved entry needs generation
        async with get_db_connection() as conn:
            needs_generation = await check_resolved_needs_generation(
                conn, chat_resolved_id
            )

        if not needs_generation:
            # Resources already populated — link and proceed immediately
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
        elif should_proceed:
            # Auto-generate: emit generate with save=True
            # generation_complete will handle linking + emit
            await _emit_chat_generate(
                sid=sid,
                profile_id=profile_id,
                attempt_id=attempt_id,
                chat_entry_id=chat_entry_id,
                department_id=department_id,
                chat_resolved_id=chat_resolved_id,
                draft_id=draft_id,
            )
        else:
            # User decides — emit attempt_started so they see lobby (Next/Customize)
            await internal_sio.emit(
                "attempt_started",
                AttemptStartedData(
                    sid=sid,
                    attempt_id=str(attempt_id),
                    chat_entry_id=str(chat_entry_id),
                ).model_dump(mode="json"),
            )

    except Exception as e:
        logger.exception(f"Error in attempt_proceed: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="proceed",
                message=f"Failed to proceed: {e}",
            ).model_dump(mode="json"),
        )

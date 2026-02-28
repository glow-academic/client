"""Attempt end handler.

Handles: attempt_end — end a single chat within an attempt.

Flow:
1. Mark chat completed via attempt_proceed(completed_chat_id=...)
2. If grade=True: create group + run + grade entry, emit to generate pipeline
"""

import uuid
from typing import Any

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptEndPayload
from app.socket.v5.internal.attempt.types import (
    AttemptErrorData,
    AttemptGradeStartData,
    AttemptProceedData,
    GenerateRequestData,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

GRADE_RESOURCE_TYPES = [
    "feedbacks",
    "strengths",
    "improvements",
    "analyses",
    "highlights",
    "replacements",
]


@sio.event  # type: ignore
async def attempt_end(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_end event — end a single chat, optionally grade."""
    try:
        payload = AttemptEndPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="end",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        attempt_id = str(payload.attempt_id)
        chat_id = str(payload.chat_id)

        # Step 1: Trigger grading if requested
        if payload.grade:
            async with get_db_connection() as conn:
                group_id = await conn.fetchval(
                    """INSERT INTO groups_entry (created_at, updated_at, session_id)
                    VALUES (NOW(), NOW(), (
                        SELECT id FROM sessions_entry
                        WHERE profile_id = $1 AND active = true
                        ORDER BY created_at DESC LIMIT 1
                    )) RETURNING id""",
                    profile_id,
                )

                run_id = await conn.fetchval(
                    """INSERT INTO runs_entry (group_id)
                    VALUES ($1) RETURNING id""",
                    group_id,
                )

                await conn.execute(
                    """INSERT INTO profiles_runs_connection (profiles_id, run_id)
                    SELECT ppj.profiles_id, $2
                    FROM profile_profiles_junction ppj
                    WHERE ppj.profile_id = $1
                    LIMIT 1""",
                    profile_id,
                    run_id,
                )

                grade_id = await conn.fetchval(
                    """INSERT INTO attempt_grade_entry (chat_id, run_id, created_at, updated_at, score, passed)
                    VALUES ($1, $2, NOW(), NOW(), 0, false)
                    RETURNING id""",
                    uuid.UUID(chat_id),
                    run_id,
                )

            await internal_sio.emit(
                "attempt_grade_start",
                AttemptGradeStartData(
                    sid=sid,
                    chat_id=chat_id,
                    grade_id=str(grade_id) if grade_id else None,
                ).model_dump(mode="json"),
            )

            await internal_sio.emit(
                "generate",
                GenerateRequestData(
                    sid=sid,
                    profile_id=profile_id_str,
                    artifact_types=[{"name": "attempt", "operation": "get"}],
                    artifact_id=attempt_id,
                    resource_types=GRADE_RESOURCE_TYPES,
                    save=True,
                    run_id=str(run_id),
                    group_id=str(group_id),
                    metadata={
                        "attempt_id": attempt_id,
                        "chat_id": chat_id,
                        "grade_id": str(grade_id) if grade_id else None,
                    },
                ).model_dump(mode="json"),
            )

        # Step 2: Delegate to attempt_proceed with completed_chat_id
        await internal_sio.emit(
            "attempt_proceed",
            AttemptProceedData(
                sid=sid,
                attempt_id=attempt_id,
                completed_chat_id=chat_id,
            ).model_dump(mode="json"),
        )

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.end.ended",
                template="{{ actor.name }} ended chat",
                context={"attempt_id": attempt_id},
                endpoint="/socket/v5/attempt/end",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_end: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="end",
                message=f"Failed to end chat: {e}",
                chat_id=str(data.get("chat_id", "")) if data.get("chat_id") else None,
            ).model_dump(mode="json"),
        )

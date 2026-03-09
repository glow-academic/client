"""Attempt end handler.

Handles: attempt_end — end a single chat within an attempt.

Flow:
1. Mark chat completed via attempt_proceed(completed_chat_id=...)
2. If grade=True: create group + run + grade entry, emit to generate pipeline
"""

import uuid
from typing import Any

from app.infra.globals import get_internal_sio, get_pool, get_redis_client, sio
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.routes.v5.socket.client.types import AttemptEndPayload
from app.routes.v5.socket.internal.attempt.types import (
    AttemptErrorData,
    AttemptGradeStartData,
    AttemptProceedData,
    GenerateRequestData,
)
from app.routes.v5.tools.entries.attempt_grade.create import create_attempt_grade
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
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
            session_id_str = await find_session_by_socket(sid)
            if not session_id_str:
                raise ValueError("Session not found for socket")
            session_id = uuid.UUID(session_id_str)

            pool = get_pool()
            identity = await resolve_profile_identity_context(
                pool, profile_id, get_redis_client(), session_id=session_id
            )
            profiles_id = identity.profiles_id if identity else None

            async with pool.acquire() as conn:
                group_result = await create_group(
                    conn,
                    session_id=session_id,
                )
                group_id = group_result.id

                run_result = await create_run(
                    conn,
                    session_id=session_id,
                    group_id=group_id,
                    profiles_id=profiles_id,
                )
                run_id = run_result.id

                call_result = await create_call(
                    conn,
                    run_id=run_id,
                    session_id=session_id,
                )
                call_id = call_result.id

                grade_result = await create_attempt_grade(
                    conn,
                    chat_id=uuid.UUID(chat_id),
                    call_id=call_id,
                    run_id=run_id,
                    time_taken=0,
                    passed=False,
                    score=0,
                )
                grade_id = grade_result.id

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
                group_id=str(payload.group_id),
                completed_chat_id=chat_id,
            ).model_dump(mode="json"),
        )

        # Log activity
        try:
            pass
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

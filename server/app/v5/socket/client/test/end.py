"""Test end handler.

Handles: test_end — end a single invocation within a test.

Flow:
1. If grade=True: create group + run + grade entry, emit to generate pipeline
2. Delegate to test_proceed(completed_invocation_id=...) to move to next
"""

import uuid
from typing import Any

from app.v5.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.v5.infra.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.v5.socket.client.types import TestEndPayload
from app.v5.socket.internal.test.types import TestErrorData, TestProceedData
from app.v5.utils.logging.db_logger import get_logger

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
async def test_end(sid: str, data: dict[str, Any]) -> None:
    """Handle test_end event — end a single invocation, optionally grade."""
    try:
        payload = TestEndPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "test_error",
                TestErrorData(
                    sid=sid,
                    message="Profile not found. Please reconnect.",
                    error_type="auth",
                ).model_dump(mode="json"),
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        test_id = str(payload.test_id)
        test_invocation_id = str(payload.test_invocation_id)

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
                    """INSERT INTO test_grade_entry (invocation_id, run_id, created_at, updated_at, score, passed)
                    VALUES ($1, $2, NOW(), NOW(), 0, false)
                    RETURNING id""",
                    uuid.UUID(test_invocation_id),
                    run_id,
                )

            # Emit grade_start
            await internal_sio.emit(
                "test_grade_start",
                {
                    "sid": sid,
                    "test_id": test_id,
                    "test_invocation_id": test_invocation_id,
                    "grade_id": str(grade_id) if grade_id else None,
                },
            )

            # TODO: emit generate with grade resource types + LLM config
            # For now, just emit the event shape — LLM config resolution is a TODO
            # await internal_sio.emit(
            #     "generate_artifact",
            #     { ... },
            # )

        # Step 2: Delegate to test_proceed with completed_invocation_id
        await internal_sio.emit(
            "test_proceed",
            TestProceedData(
                sid=sid,
                test_id=test_id,
                completed_invocation_id=test_invocation_id,
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in test_end: {e}")
        await internal_sio.emit(
            "test_error",
            TestErrorData(
                sid=sid,
                message=f"Failed to end invocation: {e}",
                error_type="end",
            ).model_dump(mode="json"),
        )

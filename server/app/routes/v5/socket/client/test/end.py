"""Test end handler.

Handles: test_end — end a single invocation within a test.

Flow:
1. If grade=True: create group + run + call + grade entry, emit to generate pipeline
2. Delegate to test_proceed(completed_invocation_id=...) to move to next
"""

import uuid
from typing import Any

from app.infra.globals import get_internal_sio, get_pool, get_redis_client, sio
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.routes.v5.socket.client.types import TestEndPayload
from app.routes.v5.socket.internal.test.types import TestErrorData, TestProceedData
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.test_grade.create import create_test_grade
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
            session_id_str = await find_session_by_socket(sid)
            if not session_id_str:
                await internal_sio.emit(
                    "test_error",
                    TestErrorData(
                        sid=sid,
                        message="Session not found. Please reconnect.",
                        error_type="auth",
                    ).model_dump(mode="json"),
                )
                return

            session_id = uuid.UUID(session_id_str)
            pool = get_pool()
            identity = await resolve_profile_identity_context(
                pool, profile_id, get_redis_client(), session_id=session_id
            )
            profiles_id = identity.profiles_id if identity else None

            async with pool.acquire() as conn:
                group = await create_group(conn, session_id=session_id)
                run = await create_run(
                    conn,
                    group_id=group.id,
                    session_id=session_id,
                    profiles_id=profiles_id,
                )
                call = await create_call(
                    conn, run_id=run.id, session_id=session_id
                )
                grade = await create_test_grade(
                    conn,
                    invocation_id=uuid.UUID(test_invocation_id),
                    call_id=call.id,
                    run_id=run.id,
                    time_taken=0,
                    passed=False,
                    score=0,
                )

            # Emit grade_start
            await internal_sio.emit(
                "test_grade_start",
                {
                    "sid": sid,
                    "test_id": test_id,
                    "test_invocation_id": test_invocation_id,
                    "grade_id": str(grade.id),
                },
            )

            # TODO: emit generate with grade resource types + LLM config

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

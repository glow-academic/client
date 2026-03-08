"""Test event translators — pure business logic with emit: EmitFn.

Each function receives raw event data and emits a translated event.
"""

from __future__ import annotations

from typing import Any

import asyncpg

from app.infra.websocket.socket_event import EmitFn, client_event, internal_event


# ---------------------------------------------------------------------------
# test_progress_update → test_grade_start
# ---------------------------------------------------------------------------


async def test_progress_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Translate test_progress_update → test_grade_start."""
    from app.infra.websocket.test_types import TestProgressData

    invocation_id = data.get("invocation_id") or data.get("chat_id")
    if not invocation_id:
        return

    sid = data.get("sid")
    invocation_id_str = str(invocation_id)
    rooms = [sid, f"test_{invocation_id_str}"] if sid else []

    await emit([
        internal_event(
            "test_grade_start",
            TestProgressData(
                sid=sid,
                rooms=rooms,
                invocation_id=invocation_id_str,
                run_id=data.get("run_id"),
                current_run=data.get("current_run"),
                total_runs=data.get("total_runs"),
                message=data.get("message"),
            ).model_dump(mode="json"),
        )
    ])


# ---------------------------------------------------------------------------
# test_run_done → test_run_complete
# ---------------------------------------------------------------------------


async def test_run_done_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Translate test_run_done → test_run_complete."""
    from app.infra.websocket.test_types import TestRunCompleteData

    invocation_id = data.get("invocation_id") or data.get("chat_id")
    if not invocation_id:
        return

    invocation_id_str = str(invocation_id)
    current_run = data.get("current_run", 1)
    total_runs = data.get("total_runs", 1)
    remaining_runs = total_runs - current_run
    sid = data.get("sid")
    rooms = [sid, f"test_{invocation_id_str}"] if sid else []

    await emit([
        internal_event(
            "test_run_complete",
            TestRunCompleteData(
                sid=sid,
                rooms=rooms,
                invocation_id=invocation_id_str,
                run_id=str(data.get("run_id")) if data.get("run_id") else None,
                original_run_resource_id=str(data.get("original_run_resource_id"))
                if data.get("original_run_resource_id")
                else None,
                tool_calls=data.get("tool_calls"),
                current_run=current_run,
                total_runs=total_runs,
                remaining_runs=remaining_runs,
            ).model_dump(mode="json"),
        )
    ])


# ---------------------------------------------------------------------------
# test_error_event → test_error
# ---------------------------------------------------------------------------


async def test_error_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Translate test_error_event → test_error."""
    from app.infra.websocket.test_types import TestErrorData

    invocation_id = data.get("invocation_id") or data.get("chat_id")
    message = data.get("error_message") or data.get("message", "Test error")
    sid = data.get("sid")
    invocation_id_str = str(invocation_id) if invocation_id else None
    rooms = (
        [sid, f"test_{invocation_id_str}"]
        if sid and invocation_id_str
        else ([sid] if sid else [])
    )

    await emit([
        internal_event(
            "test_error",
            TestErrorData(
                sid=sid,
                rooms=rooms,
                invocation_id=invocation_id_str,
                run_id=str(data.get("run_id")) if data.get("run_id") else None,
                message=message,
                error_type=data.get("error_type"),
            ).model_dump(mode="json"),
        )
    ])


# ---------------------------------------------------------------------------
# test_next → find next pending invocation, emit test_run or test_all_complete
# ---------------------------------------------------------------------------


async def test_next_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
    conn: asyncpg.Connection,
) -> None:
    """Find next invocation with pending runs and emit test_run or test_all_complete."""
    import uuid

    from app.infra.websocket.test_types import TestAllCompleteEvent
    from app.routes.v5.api.main.test.get import get_test_internal
    from app.utils.logging.db_logger import get_logger

    logger = get_logger(__name__)

    sid = data.get("sid", "")
    if not sid:
        return

    try:
        test_id = uuid.UUID(str(data["test_id"]))
    except (KeyError, ValueError) as e:
        logger.exception(f"Invalid test_next data: {e}")
        await emit([
            client_event(
                "test_error",
                {"message": f"Failed to find next run: {e}", "error_type": "internal"},
                room=sid,
            )
        ])
        return

    try:
        result = await get_test_internal(
            conn=conn,
            test_id=test_id,
            bypass_cache=True,
        )
    except Exception as e:
        logger.exception(f"Error in test_next: {e}")
        await emit([
            client_event(
                "test_error",
                {"message": f"Failed to find next run: {e}", "error_type": "internal"},
                room=sid,
            )
        ])
        return

    if not result.invocations:
        logger.warning(f"No invocations found for test {test_id}")
        await emit([
            client_event(
                "test_all_complete",
                TestAllCompleteEvent(
                    invocation_id="",
                    total_runs=0,
                    success=True,
                ).model_dump(mode="json"),
                room=sid,
            )
        ])
        return

    # Find first incomplete invocation
    for invocation in result.invocations:
        if not invocation.invocation_completed:
            # Found a pending invocation — emit test_run internally
            await emit([
                internal_event(
                    "test_run",
                    {
                        "sid": sid,
                        "invocation_id": str(invocation.invocation_id),
                        "test_id": str(test_id),
                    },
                )
            ])
            return

    # All invocations complete — emit test_all_complete
    last_invocation = result.invocations[-1]
    total = len(result.invocations)
    await emit([
        client_event(
            "test_all_complete",
            TestAllCompleteEvent(
                invocation_id=str(last_invocation.invocation_id),
                total_runs=total,
                success=True,
            ).model_dump(mode="json"),
            room=sid,
        )
    ])
    logger.info(f"All test runs complete - test_id={test_id}")

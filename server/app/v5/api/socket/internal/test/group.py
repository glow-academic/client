"""Internal test_group handler — orchestrate sequential runs within a group.

Handles: @internal_sio.on("test_group")

Flow:
1. Find the next run in the group (first if prev_run_id=None, otherwise next after prev_run_id)
2. If no more runs → emit test_group_complete
3. If found → emit test_run (delegates actual execution)

Recursion: when test_run completes, the completion handler should emit
test_group again with prev_run_id=<completed run> to continue the sequence.
(TODO: wire up in completion handler)
"""

from __future__ import annotations

from typing import Any

from app.v5.infra.websocket.get_db_connection import get_db_connection
from app.globals import get_internal_sio
from app.v5.api.socket.client.types import TestGroupPayload
from app.v5.api.socket.internal.test.types import TestErrorData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("test_group")  # type: ignore
async def test_group_handler(data: dict[str, Any]) -> None:
    """Handle test_group — find next run in group, delegate to test_run."""
    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = data.get("profile_id")
    if not profile_id_str:
        return

    try:
        payload = TestGroupPayload(**data)
    except Exception as e:
        logger.exception(f"Invalid test_group payload: {e}")
        return

    try:
        test_id = payload.test_id
        test_invocation_id = payload.test_invocation_id
        group_id = payload.group_id
        prev_run_id = payload.prev_run_id

        async with get_db_connection() as conn:
            if prev_run_id is None:
                # First run in the group — get the earliest
                next_run_id = await conn.fetchval(
                    """SELECT re.id
                    FROM runs_entry re
                    WHERE re.group_id = $1 AND re.active = true
                    ORDER BY re.created_at
                    LIMIT 1""",
                    group_id,
                )
            else:
                # Find the run after prev_run_id (by creation order)
                next_run_id = await conn.fetchval(
                    """SELECT re.id
                    FROM runs_entry re
                    WHERE re.group_id = $1 AND re.active = true
                      AND re.created_at > (
                          SELECT created_at FROM runs_entry WHERE id = $2
                      )
                    ORDER BY re.created_at
                    LIMIT 1""",
                    group_id,
                    prev_run_id,
                )

        if not next_run_id:
            # No more runs — group is complete
            await internal_sio.emit(
                "test_group_complete",
                {
                    "sid": sid,
                    "test_id": str(test_id),
                    "test_invocation_id": str(test_invocation_id),
                    "group_id": str(group_id),
                },
            )
            return

        # Delegate to test_run
        await internal_sio.emit(
            "test_run",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                "test_id": str(test_id),
                "test_invocation_id": str(test_invocation_id),
                "run_id": str(next_run_id),
                # Pass group context so test_run completion can re-invoke test_group
                "group_id": str(group_id),
            },
        )

        logger.info(
            f"Test group run - group_id={group_id}, "
            f"next_run_id={next_run_id}, prev_run_id={prev_run_id}"
        )

    except Exception as e:
        logger.exception(f"Error in test_group: {e}")
        await internal_sio.emit(
            "test_error",
            TestErrorData(
                sid=sid,
                message=f"Failed to run group: {e}",
                error_type="group",
            ).model_dump(mode="json"),
        )

"""Benchmark eval completion handler.

Tracks eval completions and advances benchmark flow when all evals for a test finish.
"""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v4.artifacts.benchmark.types import BenchmarkEvalCompletePayload
from app.sql.types import BenchmarkEvalCompleteSqlParams, BenchmarkEvalCompleteSqlRow
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

SQL_PATH = "app/sql/v4/queries/benchmark/benchmark_eval_complete_complete.sql"

# Keyed by test_id
_pending_eval_completions: dict[str, dict[str, Any]] = {}
# Keyed by run_id or group_id
_eval_context_by_run_or_group: dict[str, dict[str, Any]] = {}


def track_pending_eval(
    *,
    test_id: str,
    attempt_id: str,
    eval_id: str,
    run_id: str | None,
    group_id: str | None,
    use_groups: bool,
    sid: str,
) -> None:
    """Track an eval pending completion for a given test."""
    key = group_id or run_id
    if not key:
        return

    _eval_context_by_run_or_group[key] = {
        "test_id": test_id,
        "attempt_id": attempt_id,
        "eval_id": eval_id,
        "run_id": run_id,
        "group_id": group_id,
        "use_groups": use_groups,
        "sid": sid,
    }

    if test_id not in _pending_eval_completions:
        _pending_eval_completions[test_id] = {
            "pending_count": 0,
            "total_count": 0,
            "test_id": test_id,
            "attempt_id": attempt_id,
            "eval_id": eval_id,
            "run_id": run_id,
            "group_id": group_id,
            "use_groups": use_groups,
            "sid": sid,
        }

    _pending_eval_completions[test_id]["pending_count"] += 1
    _pending_eval_completions[test_id]["total_count"] += 1


@internal_sio.on("benchmark_eval_complete")  # type: ignore
async def benchmark_eval_complete_internal(data: dict[str, Any]) -> None:
    """Handle benchmark_eval_complete events and advance when all evals finish."""
    payload = BenchmarkEvalCompletePayload(**data)
    key = payload.group_id or payload.run_id
    if not key:
        return

    ctx = _eval_context_by_run_or_group.get(key)
    if not ctx:
        return

    test_id = ctx.get("test_id")
    if not test_id:
        return

    # Persist completion (no-op SQL, but keeps pattern consistent)
    sid = payload.sid or ctx.get("sid") or ""
    profile_id_str = await find_profile_by_socket(sid) if sid else None
    if profile_id_str:
        async with get_db_connection() as conn:
            params = BenchmarkEvalCompleteSqlParams(
                profile_id=uuid.UUID(profile_id_str),
                test_id=uuid.UUID(test_id),
                attempt_id=uuid.UUID(ctx["attempt_id"]),
                eval_id=uuid.UUID(ctx["eval_id"]),
                success=payload.success,
                run_id=uuid.UUID(ctx["run_id"]) if ctx.get("run_id") else None,
                group_id=uuid.UUID(ctx["group_id"]) if ctx.get("group_id") else None,
                agent_id=None,
                tool_id=None,
                message=payload.message,
            )
            cast(
                BenchmarkEvalCompleteSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

    # Decrement pending count
    info = _pending_eval_completions.get(test_id)
    if not info:
        return

    info["pending_count"] -= 1

    if not payload.success:
        await internal_sio.emit(
            "benchmark_error",
            {
                "attempt_id": ctx.get("attempt_id"),
                "eval_id": ctx.get("eval_id"),
                "test_id": test_id,
                "run_id": ctx.get("run_id"),
                "group_id": ctx.get("group_id"),
                "error_message": payload.message or "Eval failed",
                "sid": sid,
            },
        )
        _pending_eval_completions.pop(test_id, None)
        _eval_context_by_run_or_group.pop(key, None)
        return

    if info["pending_count"] <= 0:
        await internal_sio.emit(
            "benchmark_advance",
            {
                "test_id": test_id,
                "attempt_id": info.get("attempt_id"),
                "run_id": info.get("run_id"),
                "group_id": info.get("group_id"),
                "sid": sid,
            },
        )

        await internal_sio.emit(
            "benchmark_end",
            {
                "test_id": test_id,
                "attempt_id": info.get("attempt_id"),
                "eval_id": info.get("eval_id"),
                "run_id": info.get("run_id"),
                "group_id": info.get("group_id"),
                "use_groups": info.get("use_groups"),
                "sid": sid,
            },
        )

        _pending_eval_completions.pop(test_id, None)
        _eval_context_by_run_or_group.pop(key, None)

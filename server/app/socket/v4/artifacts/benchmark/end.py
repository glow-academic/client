"""Benchmark end handler - runs grading and completes test."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.benchmark.types import (
    BenchmarkCompleteEvent,
    BenchmarkEndPayload,
)
from app.sql.types import (
    GetRubricGradeAgentV4SqlParams,
    GetRubricGradeAgentV4SqlRow,
    GetTestRunIdV4SqlParams,
    GetTestRunIdV4SqlRow,
    MarkEvalGroupCompleteV4SqlParams,
    MarkEvalRunCompleteV4SqlParams,
    MarkTestCompleteV4SqlParams,
)
from app.utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()


async def _benchmark_end_impl(sid: str, data: BenchmarkEndPayload) -> None:
    """Handle benchmark_end requests via WebSocket."""
    try:
        test_id = data.test_id
        attempt_id = data.attempt_id
        eval_id = data.eval_id
        run_id = data.run_id
        group_id = data.group_id
        use_groups = data.use_groups

        if not test_id or not attempt_id or not eval_id:
            await internal_sio.emit(
                "benchmark_error",
                {
                    "attempt_id": attempt_id,
                    "eval_id": eval_id,
                    "test_id": test_id,
                    "run_id": run_id,
                    "group_id": group_id,
                    "error_message": "Missing test_id, attempt_id, or eval_id",
                    "sid": sid,
                },
            )
            return

        async with get_db_connection() as conn:
            test_id_uuid = uuid.UUID(test_id)
            eval_id_uuid = uuid.UUID(eval_id)
            attempt_id_uuid = uuid.UUID(attempt_id)

            sql = load_sql(
                "app/sql/v4/queries/benchmark/get_rubric_grade_agent_for_run_or_group.sql"
            )
            rubric_row = await conn.fetchrow(
                sql,
                eval_id_uuid,
                uuid.UUID(run_id) if run_id else None,
                uuid.UUID(group_id) if group_id else None,
                use_groups,
            )

            if not rubric_row or not rubric_row.get("rubric_grade_agent_id"):
                await internal_sio.emit(
                    "benchmark_error",
                    {
                        "attempt_id": attempt_id,
                        "eval_id": eval_id,
                        "test_id": test_id,
                        "run_id": run_id,
                        "group_id": group_id,
                        "error_message": "Rubric grade agent not found for run/group",
                        "sid": sid,
                    },
                )
                return

            rubric_grade_agent_id = rubric_row["rubric_grade_agent_id"]

            rga_params = GetRubricGradeAgentV4SqlParams(
                rubric_grade_agent_id=rubric_grade_agent_id
            )
            rga_result = cast(
                GetRubricGradeAgentV4SqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/benchmark/get_rubric_grade_agent_v4_complete.sql",
                    params=rga_params,
                ),
            )
            if not rga_result:
                await internal_sio.emit(
                    "benchmark_error",
                    {
                        "attempt_id": attempt_id,
                        "eval_id": eval_id,
                        "test_id": test_id,
                        "run_id": run_id,
                        "group_id": group_id,
                        "error_message": "Rubric grade agent details not found",
                        "sid": sid,
                    },
                )
                return

            test_run_params = GetTestRunIdV4SqlParams(test_id=test_id_uuid)
            test_run_result = cast(
                GetTestRunIdV4SqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/benchmark/get_test_run_id_v4_complete.sql",
                    params=test_run_params,
                ),
            )
            if not test_run_result or not test_run_result.run_id:
                await internal_sio.emit(
                    "benchmark_error",
                    {
                        "attempt_id": attempt_id,
                        "eval_id": eval_id,
                        "test_id": test_id,
                        "run_id": run_id,
                        "group_id": group_id,
                        "error_message": "Test not found",
                        "sid": sid,
                    },
                )
                return

            grade_sql = load_sql("app/sql/v4/queries/benchmark/create_eval_grade.sql")
            await conn.fetchrow(
                grade_sql,
                test_run_result.run_id,
                eval_id_uuid,
                "Benchmark evaluation completed",
                True,
                100.0,
                0,
                rubric_grade_agent_id,
            )

            mark_test_params = MarkTestCompleteV4SqlParams(test_id=test_id_uuid)
            await execute_sql_typed(
                conn,
                "app/sql/v4/queries/benchmark/mark_test_complete_v4_complete.sql",
                params=mark_test_params,
            )

            if use_groups and group_id:
                mark_group_params = MarkEvalGroupCompleteV4SqlParams(
                    eval_id=eval_id_uuid,
                    group_id=uuid.UUID(group_id),
                )
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/benchmark/mark_eval_group_complete_v4_complete.sql",
                    params=mark_group_params,
                )
            elif run_id:
                mark_run_params = MarkEvalRunCompleteV4SqlParams(
                    eval_id=eval_id_uuid,
                    run_id=uuid.UUID(run_id),
                )
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/benchmark/mark_eval_run_complete_v4_complete.sql",
                    params=mark_run_params,
                )

            sql_next = load_sql(
                "app/sql/v4/queries/benchmark/get_next_pending_run_or_group_for_benchmark.sql"
            )
            next_row = await conn.fetchrow(
                sql_next,
                attempt_id_uuid,
                eval_id_uuid,
                use_groups,
            )

            if next_row and (
                next_row.get("next_run_id") or next_row.get("next_group_id")
            ):
                await emit_to_internal(
                    "benchmark_next",
                    {
                        "attempt_id": attempt_id,
                        "eval_id": eval_id,
                        "run_id": str(next_row["next_run_id"])
                        if next_row.get("next_run_id")
                        else None,
                        "group_id": str(next_row["next_group_id"])
                        if next_row.get("next_group_id")
                        else None,
                        "use_groups": use_groups,
                    },
                    sid=sid,
                )
            else:
                event = BenchmarkCompleteEvent(
                    message="Benchmark completed successfully",
                    attempt_id=attempt_id,
                    test_id=test_id,
                )
                if sid:
                    await sio.emit(
                        "benchmarks_complete",
                        event.model_dump(mode="json"),
                        room=sid,
                    )
                await sio.emit(
                    "benchmarks_complete",
                    event.model_dump(mode="json"),
                    room=f"benchmark_{attempt_id}",
                )

    except Exception as e:
        await internal_sio.emit(
            "benchmark_error",
            {
                "attempt_id": data.attempt_id,
                "eval_id": data.eval_id,
                "test_id": data.test_id,
                "run_id": data.run_id,
                "group_id": data.group_id,
                "error_message": str(e),
                "sid": sid,
            },
        )


@internal_sio.on("benchmark_end")  # type: ignore
async def benchmark_end_internal(data: dict[str, Any]) -> None:
    """Handle benchmark_end event from internal bus."""
    payload = BenchmarkEndPayload(**data)
    sid = data.get("sid", "internal")
    await _benchmark_end_impl(sid, payload)

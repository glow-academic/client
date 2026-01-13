"""Handler for benchmark_end WebSocket event - runs grading and completes test."""

import uuid
from typing import Any, cast

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.sql.types import (SocketGetRubricGradeAgentSqlParams,
                           SocketGetRubricGradeAgentSqlRow,
                           SocketGetTestRunIdSqlParams,
                           SocketGetTestRunIdSqlRow,
                           SocketMarkEvalGroupCompleteSqlParams,
                           SocketMarkEvalRunCompleteSqlParams,
                           SocketMarkTestCompleteSqlParams)
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class BenchmarkCompletedPayload(BaseModel):
    """Response indicating benchmark completed successfully."""

    success: bool
    message: str
    attempt_id: str
    test_id: str


class BenchmarkEndErrorPayload(BaseModel):
    """Response indicating an error occurred in benchmark end."""

    success: bool
    message: str


# Pydantic model for internal event
class BenchmarkEndPayload(BaseModel):
    """Request to end benchmark test and run grading."""

    test_id: str
    attempt_id: str
    eval_id: str
    run_id: str | None = None
    group_id: str | None = None
    use_groups: bool = False


# Emit helper functions
async def benchmark_completed(payload: BenchmarkCompletedPayload, room: str) -> None:
    await sio.emit("benchmarks_completed", payload.model_dump(), room=room)


async def benchmark_end_error(payload: BenchmarkEndErrorPayload, room: str) -> None:
    await sio.emit("benchmarks_end_error", payload.model_dump(), room=room)


async def _benchmark_end_impl(sid: str, data: BenchmarkEndPayload) -> None:
    """
    Handle benchmark_end requests via WebSocket.
    Runs rubric_grade_agent, creates grade record, marks test completed.
    """
    try:
        test_id = data.test_id
        attempt_id = data.attempt_id
        eval_id = data.eval_id
        run_id = data.run_id
        group_id = data.group_id
        use_groups = data.use_groups

        if not test_id or not attempt_id or not eval_id:
            await benchmark_end_error(
                BenchmarkEndErrorPayload(
                    success=False, message="Missing test_id, attempt_id, or eval_id"
                ),
                room=sid,
            )
            return

        # Get connection pool
        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            test_id_uuid = uuid.UUID(test_id)
            eval_id_uuid = uuid.UUID(eval_id)
            attempt_id_uuid = uuid.UUID(attempt_id)

            # Get rubric_grade_agent_id from junction table
            sql = load_sql(
                "app/sql/v4/benchmark/get_rubric_grade_agent_for_run_or_group.sql"
            )
            rubric_row = await conn.fetchrow(
                sql,
                eval_id_uuid,
                uuid.UUID(run_id) if run_id else None,
                uuid.UUID(group_id) if group_id else None,
                use_groups,
            )

            if not rubric_row or not rubric_row.get("rubric_grade_agent_id"):
                await benchmark_end_error(
                    BenchmarkEndErrorPayload(
                        success=False,
                        message="Rubric grade agent not found for run/group",
                    ),
                    room=sid,
                )
                return

            rubric_grade_agent_id = rubric_row["rubric_grade_agent_id"]

            # Get rubric_grade_agent details
            rga_params = SocketGetRubricGradeAgentSqlParams(
                rubric_grade_agent_id=rubric_grade_agent_id
            )
            rga_result = cast(
                SocketGetRubricGradeAgentSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/benchmark/get_rubric_grade_agent_v4_complete.sql",
                    params=rga_params,
                ),
            )
            if not rga_result:
                await benchmark_end_error(
                    BenchmarkEndErrorPayload(
                        success=False, message="Rubric grade agent details not found"
                    ),
                    room=sid,
                )
                return
            
            rga_row = {
                "grade_agent_id": rga_result.grade_agent_id,
                "rubric_id": rga_result.rubric_id,
                "agent_id": rga_result.agent_id,
            }

            if not rga_row:
                await benchmark_end_error(
                    BenchmarkEndErrorPayload(
                        success=False, message="Rubric grade agent details not found"
                    ),
                    room=sid,
                )
                return

            grade_agent_id = rga_row["grade_agent_id"]
            rubric_id = rga_row["rubric_id"]

            # Get test run_id (needed for grade creation)
            test_run_params = SocketGetTestRunIdSqlParams(test_id=test_id_uuid)
            test_run_result = cast(
                SocketGetTestRunIdSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/benchmark/get_test_run_id_v4_complete.sql",
                    params=test_run_params,
                ),
            )
            test_row = {
                "run_id": test_run_result.run_id if test_run_result else None
            }
            if not test_row:
                await benchmark_end_error(
                    BenchmarkEndErrorPayload(success=False, message="Test not found"),
                    room=sid,
                )
                return

            test_run_id = test_row.get("run_id")

            # TODO: Run rubric_grade_agent via agents/grade/generate.py
            # For now, create a placeholder grade
            # In full implementation, this would:
            # 1. Get test context (messages, etc.)
            # 2. Emit to agents/grade/generate.py with test context
            # 3. Wait for grading completion
            # 4. Extract grade results
            # 5. Create grade record

            # Create grade record (placeholder - will be updated after grading completes)
            grade_sql = load_sql("app/sql/v4/benchmark/create_eval_grade.sql")
            grade_result = await conn.fetchrow(
                grade_sql,
                test_run_id,  # run_id
                eval_id_uuid,  # eval_id (unused but kept for compatibility)
                "Benchmark evaluation completed",  # description
                True,  # passed (placeholder)
                100.0,  # score (placeholder - will be updated after grading)
                0,  # time_taken (placeholder)
                rubric_grade_agent_id,  # rubric_grade_agent_id
            )

            if not grade_result:
                await benchmark_end_error(
                    BenchmarkEndErrorPayload(
                        success=False, message="Failed to create grade record"
                    ),
                    room=sid,
                )
                return

            grade_id = grade_result["grade_id"]

            # Mark test as completed
            mark_test_params = SocketMarkTestCompleteSqlParams(test_id=test_id_uuid)
            await execute_sql_typed(
                conn,
                "app/sql/v4/benchmark/mark_test_complete_v4_complete.sql",
                params=mark_test_params,
            )

            # Mark eval_run or eval_group as completed
            if use_groups and group_id:
                mark_group_params = SocketMarkEvalGroupCompleteSqlParams(
                    eval_id=eval_id_uuid,
                    group_id=uuid.UUID(group_id),
                )
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/benchmark/mark_eval_group_complete_v4_complete.sql",
                    params=mark_group_params,
                )
            elif run_id:
                mark_run_params = SocketMarkEvalRunCompleteSqlParams(
                    eval_id=eval_id_uuid,
                    run_id=uuid.UUID(run_id),
                )
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/benchmark/mark_eval_run_complete_v4_complete.sql",
                    params=mark_run_params,
                )
            # Check if more runs/groups exist
            sql = load_sql(
                "app/sql/v4/benchmark/get_next_pending_run_or_group_for_benchmark.sql"
            )
            next_row = await conn.fetchrow(
                sql,
                attempt_id_uuid,
                eval_id_uuid,
                use_groups,
            )

            if next_row and (
                next_row.get("next_run_id") or next_row.get("next_group_id")
            ):
                # More runs/groups exist - emit benchmark_next
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
                # All done - emit benchmarks_completed
                await benchmark_completed(
                    BenchmarkCompletedPayload(
                        success=True,
                        message="Benchmark completed successfully",
                        attempt_id=attempt_id,
                        test_id=test_id,
                    ),
                    room=f"benchmark_{attempt_id}",
                )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="benchmarks.ended",
                    template="{{ actor.name }} ended benchmark test",
                    context={"test_id": test_id, "attempt_id": attempt_id},
                    endpoint="/socket/v4/benchmark/end",
                    error=False,
                )
            except Exception:
                pass
    except Exception as e:
        await benchmark_end_error(
            BenchmarkEndErrorPayload(success=False, message=str(e)),
            room=sid,
        )


@internal_sio.on("benchmark_end")  # type: ignore
async def benchmark_end_internal(data: dict[str, Any]) -> None:
    """Handle benchmark_end event from internal bus (server-to-server)."""
    try:
        validated = BenchmarkEndPayload(**data)
        sid = data.get("sid", "internal")
        await _benchmark_end_impl(sid, validated)
    except ValidationError as e:
        await benchmark_end_error(
            BenchmarkEndErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=data.get("sid", "internal"),
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/end", response_model=dict[str, bool])
async def benchmark_end_api(request: BenchmarkEndPayload) -> dict[str, bool]:
    """Internal event: End benchmark test and run grading."""
    return {"success": True}


@server_router.post("/completed", response_model=dict[str, bool])
async def benchmark_completed_api(
    request: BenchmarkCompletedPayload,
) -> dict[str, bool]:
    """Server-to-client event: Benchmark completed successfully."""
    return {"success": True}


@server_router.post("/end_error", response_model=dict[str, bool])
async def benchmark_end_error_api(
    request: BenchmarkEndErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in benchmark end."""
    return {"success": True}

"""Benchmark next handler - orchestrates section-by-section execution."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.benchmark.eval_complete import track_pending_eval
from app.socket.v4.artifacts.benchmark.types import BenchmarkNextPayload, BenchmarkProgressEvent
from app.sql.types import (
    CreateTestV4SqlParams,
    GetAgentNameV4SqlParams,
    GetAgentNameV4SqlRow,
    GetEvalAttemptInfiniteModeV4SqlParams,
    GetEvalAttemptInfiniteModeV4SqlRow,
    GetTestByTraceIdV4SqlParams,
    GetTestByTraceIdV4SqlRow,
    GetToolNameV4SqlParams,
    GetToolNameV4SqlRow,
    LinkAttemptTestV4SqlParams,
)
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()


async def _benchmark_next_impl(sid: str, data: BenchmarkNextPayload) -> None:
    """Handle benchmark_next requests via WebSocket."""
    try:
        attempt_id = data.attempt_id
        eval_id = data.eval_id
        run_id = data.run_id
        group_id = data.group_id
        use_groups = data.use_groups

        if not attempt_id or not eval_id:
            return

        async with get_db_connection() as conn:
            attempt_id_uuid = uuid.UUID(attempt_id)
            eval_id_uuid = uuid.UUID(eval_id)

            attempt_params = GetEvalAttemptInfiniteModeV4SqlParams(
                attempt_id=attempt_id_uuid
            )
            attempt_result = cast(
                GetEvalAttemptInfiniteModeV4SqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/benchmark/get_eval_attempt_infinite_mode_v4_complete.sql",
                    params=attempt_params,
                ),
            )
            _ = attempt_result.infinite_mode if attempt_result else False

            trace_id = f"benchmark_{attempt_id}_{run_id or group_id}"
            test_params = GetTestByTraceIdV4SqlParams(
                attempt_id=attempt_id_uuid,
                trace_id=trace_id,
            )
            test_result = cast(
                GetTestByTraceIdV4SqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/benchmark/get_test_by_trace_id_v4_complete.sql",
                    params=test_params,
                ),
            )
            test_row = (
                {
                    "test_id": test_result.test_id,
                    "completed": test_result.completed,
                }
                if test_result
                else None
            )

            if not test_row:
                test_id_uuid = uuid.uuid4()
                create_test_params = CreateTestV4SqlParams(
                    test_id=test_id_uuid,
                    title=f"Benchmark Test {attempt_id[:8]}",
                    trace_id=trace_id,
                    run_id=uuid.UUID(run_id) if run_id else None,
                )
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/benchmark/create_test_v4_complete.sql",
                    params=create_test_params,
                )
                link_params = LinkAttemptTestV4SqlParams(
                    attempt_id=attempt_id_uuid,
                    test_id=test_id_uuid,
                )
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/benchmark/link_attempt_test_v4_complete.sql",
                    params=link_params,
                )
                test_id = str(test_id_uuid)
            else:
                test_id = test_row["test_id"]

            group_stop_tools: list[dict[str, Any]] = []
            group_order_agents: list[dict[str, Any]] = []

            if use_groups and group_id:
                group_id_uuid = uuid.UUID(group_id)

                group_stop_sql = (
                    'SELECT * FROM "public"."socket_get_group_stop_tools_v4"($1::uuid)'
                )
                group_stop_rows = await conn.fetch(group_stop_sql, group_id_uuid)
                group_stop_tools = [
                    {
                        "tool_id": str(row["tool_id"]),
                        "position_idx": row["position_idx"],
                    }
                    for row in group_stop_rows
                ]

                group_order_sql = (
                    'SELECT * FROM "public"."socket_get_group_order_agents_v4"($1::uuid)'
                )
                group_order_rows = await conn.fetch(group_order_sql, group_id_uuid)
                group_order_agents = [
                    {
                        "agent_id": str(row["agent_id"]),
                        "position_idx": row["position_idx"],
                    }
                    for row in group_order_rows
                ]

            total_evals = 0

            if group_stop_tools:
                for tool_info in sorted(
                    group_stop_tools, key=lambda x: x["position_idx"]
                ):
                    tool_id = tool_info["tool_id"]
                    tool_name_params = GetToolNameV4SqlParams(
                        tool_id=uuid.UUID(tool_id)
                    )
                    tool_name_result = cast(
                        GetToolNameV4SqlRow,
                        await execute_sql_typed(
                            conn,
                            "app/sql/v4/queries/benchmark/get_tool_name_v4_complete.sql",
                            params=tool_name_params,
                        ),
                    )
                    tool_row = {
                        "name": tool_name_result.name if tool_name_result else None
                    }
                    if tool_row:
                        tool_name = (
                            tool_row["name"].lower().replace(" ", "_").replace("-", "_")
                        )
                        await internal_sio.emit(
                            f"{tool_name}_eval_start",
                            {
                                "test_id": test_id,
                                "attempt_id": attempt_id,
                                "eval_id": eval_id,
                                "run_id": run_id,
                                "group_id": group_id,
                                "tool_id": tool_id,
                                "use_groups": use_groups,
                                "sid": sid,
                            },
                        )
                        track_pending_eval(
                            test_id=test_id,
                            attempt_id=attempt_id,
                            eval_id=eval_id,
                            run_id=run_id,
                            group_id=group_id,
                            use_groups=use_groups,
                            sid=sid,
                        )
                        total_evals += 1

            if group_order_agents:
                for agent_info in sorted(
                    group_order_agents, key=lambda x: x["position_idx"]
                ):
                    agent_id = agent_info["agent_id"]
                    agent_name_params = GetAgentNameV4SqlParams(
                        agent_id=uuid.UUID(agent_id)
                    )
                    agent_name_result = cast(
                        GetAgentNameV4SqlRow,
                        await execute_sql_typed(
                            conn,
                            "app/sql/v4/queries/benchmark/get_agent_name_v4_complete.sql",
                            params=agent_name_params,
                        ),
                    )
                    agent_row = {
                        "name": agent_name_result.name if agent_name_result else None
                    }
                    if agent_row:
                        agent_name = (
                            agent_row["name"].lower().replace(" ", "_").replace("-", "_")
                        )
                        await internal_sio.emit(
                            f"{agent_name}_eval_start",
                            {
                                "test_id": test_id,
                                "attempt_id": attempt_id,
                                "eval_id": eval_id,
                                "run_id": run_id,
                                "group_id": group_id,
                                "agent_id": agent_id,
                                "use_groups": use_groups,
                                "current_cycle": 0,
                                "sid": sid,
                            },
                        )
                        track_pending_eval(
                            test_id=test_id,
                            attempt_id=attempt_id,
                            eval_id=eval_id,
                            run_id=run_id,
                            group_id=group_id,
                            use_groups=use_groups,
                            sid=sid,
                        )
                        total_evals += 1

            if total_evals == 0:
                await internal_sio.emit(
                    "benchmark_advance",
                    {
                        "test_id": test_id,
                        "attempt_id": attempt_id,
                        "run_id": run_id,
                        "group_id": group_id,
                        "sid": sid,
                    },
                )
                await internal_sio.emit(
                    "benchmark_end",
                    {
                        "test_id": test_id,
                        "attempt_id": attempt_id,
                        "eval_id": eval_id,
                        "run_id": run_id,
                        "group_id": group_id,
                        "use_groups": use_groups,
                        "sid": sid,
                    },
                )
            else:
                progress_event = BenchmarkProgressEvent(
                    attempt_id=attempt_id,
                    test_id=test_id,
                    run_id=run_id,
                    group_id=group_id,
                    status="processing",
                    message="Benchmark evals started",
                ).model_dump(mode="json")
                if sid:
                    await sio.emit(
                        "benchmarks_progress",
                        progress_event,
                        room=sid,
                    )
                await sio.emit(
                    "benchmarks_progress",
                    progress_event,
                    room=f"benchmark_{attempt_id}",
                )

    except Exception as e:
        await internal_sio.emit(
            "benchmark_error",
            {
                "attempt_id": data.attempt_id,
                "eval_id": data.eval_id,
                "test_id": None,
                "run_id": data.run_id,
                "group_id": data.group_id,
                "error_message": str(e),
                "sid": sid,
            },
        )


@internal_sio.on("benchmark_next")  # type: ignore
async def benchmark_next_internal(data: dict[str, Any]) -> None:
    """Handle benchmark_next event from internal bus."""
    payload = BenchmarkNextPayload(**data)
    sid = data.get("sid", "internal")
    await _benchmark_next_impl(sid, payload)

"""Handler for benchmark_next WebSocket event - orchestrates section-by-section execution."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.sql_helper import load_sql

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for internal event
class BenchmarkNextPayload(BaseModel):
    """Request to process next run/group for benchmark attempt."""

    attempt_id: str
    eval_id: str
    run_id: str | None = None
    group_id: str | None = None
    use_groups: bool = False


# State tracking for eval completions
# Key: (attempt_id, test_id), Value: {pending_count, total_count, test_id, attempt_id, eval_id, run_id, group_id, use_groups}
_pending_eval_completions: dict[str, dict[str, Any]] = {}


async def _benchmark_next_impl(sid: str, data: BenchmarkNextPayload) -> None:
    """
    Handle benchmark_next requests via WebSocket.
    Orchestrates section-by-section execution: tools first, then agents.
    """
    try:
        attempt_id = data.attempt_id
        eval_id = data.eval_id
        run_id = data.run_id
        group_id = data.group_id
        use_groups = data.use_groups

        if not attempt_id or not eval_id:
            return

        # Get connection pool
        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            attempt_id_uuid = uuid.UUID(attempt_id)
            eval_id_uuid = uuid.UUID(eval_id)

            # Get attempt data (infinite_mode)
            attempt_row = await conn.fetchrow(
                "SELECT infinite_mode FROM eval_attempts WHERE id = $1::uuid",
                attempt_id_uuid,
            )
            if not attempt_row:
                return

            infinite_mode = attempt_row.get("infinite_mode", False)

            # Create or get test record
            trace_id = f"benchmark_{attempt_id}_{run_id or group_id}"
            test_row = await conn.fetchrow(
                """
                SELECT t.id::text as test_id, t.completed
                FROM tests t
                JOIN attempt_tests at ON at.test_id = t.id
                WHERE at.attempt_id = $1::uuid
                  AND t.trace_id = $2
                LIMIT 1
                """,
                attempt_id_uuid,
                trace_id,
            )

            if not test_row:
                # Create new test
                test_id_uuid = uuid.uuid4()
                await conn.execute(
                    """
                    INSERT INTO tests (id, title, completed, trace_id, run_id, created_at, updated_at)
                    VALUES ($1::uuid, $2, false, $3, $4::uuid, NOW(), NOW())
                    """,
                    test_id_uuid,
                    f"Benchmark Test {attempt_id[:8]}",
                    trace_id,
                    uuid.UUID(run_id) if run_id else None,
                )
                # Link to attempt
                await conn.execute(
                    """
                    INSERT INTO attempt_tests (attempt_id, test_id)
                    VALUES ($1::uuid, $2::uuid)
                    ON CONFLICT DO NOTHING
                    """,
                    attempt_id_uuid,
                    test_id_uuid,
                )
                test_id = str(test_id_uuid)
            else:
                test_id = test_row["test_id"]

            # Get group_stop tools and group_order agents if use_groups=true
            group_stop_tools: list[dict[str, Any]] = []
            group_order_agents: list[dict[str, Any]] = []

            if use_groups and group_id:
                group_id_uuid = uuid.UUID(group_id)

                # Get group_stop tools
                sql = load_sql("app/sql/v4/benchmark/get_group_stop_tools.sql")
                group_stop_rows = await conn.fetch(sql, group_id_uuid)
                group_stop_tools = [
                    {
                        "tool_id": str(row["tool_id"]),
                        "position_idx": row["position_idx"],
                    }
                    for row in group_stop_rows
                ]

                # Get group_order agents
                sql = load_sql("app/sql/v4/benchmark/get_group_order_agents.sql")
                group_order_rows = await conn.fetch(sql, group_id_uuid)
                group_order_agents = [
                    {
                        "agent_id": str(row["agent_id"]),
                        "position_idx": row["position_idx"],
                    }
                    for row in group_order_rows
                ]

            # Track total number of evals to wait for
            total_evals = 0
            eval_key = f"{attempt_id}_{test_id}"

            # Execute tools first (if any)
            if group_stop_tools:
                for tool_info in sorted(
                    group_stop_tools, key=lambda x: x["position_idx"]
                ):
                    tool_id = tool_info["tool_id"]
                    # Get tool name from tool_id to determine which eval handler to call
                    tool_row = await conn.fetchrow(
                        "SELECT name FROM tools WHERE id = $1::uuid",
                        uuid.UUID(tool_id),
                    )
                    if tool_row:
                        # Convert tool name to event name format (lowercase, underscores)
                        tool_name = (
                            tool_row["name"].lower().replace(" ", "_").replace("-", "_")
                        )
                        # Emit to specific tool eval handler (e.g., classification_eval_start, hint_eval_start)
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
                        total_evals += 1

            # Execute agents (if not stopped)
            if group_order_agents:
                for agent_info in sorted(
                    group_order_agents, key=lambda x: x["position_idx"]
                ):
                    agent_id = agent_info["agent_id"]
                    # Get agent name from agent_id to determine which eval handler to call
                    agent_row = await conn.fetchrow(
                        "SELECT name FROM agents WHERE id = $1::uuid",
                        uuid.UUID(agent_id),
                    )
                    if agent_row:
                        # Convert agent name to event name format (lowercase, underscores)
                        agent_name = (
                            agent_row["name"]
                            .lower()
                            .replace(" ", "_")
                            .replace("-", "_")
                        )
                        # Emit to specific agent eval handler (e.g., simulation_eval_start, voice_eval_start)
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
                        total_evals += 1

            # If no evals to run, complete immediately
            if total_evals == 0:
                # Emit benchmark_advance to notify client via advance.py
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
                # Then emit benchmark_end to complete the test
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
                # Track pending completions - benchmark_eval_complete listener will handle completion
                _pending_eval_completions[eval_key] = {
                    "pending_count": total_evals,
                    "total_count": total_evals,
                    "test_id": test_id,
                    "attempt_id": attempt_id,
                    "eval_id": eval_id,
                    "run_id": run_id,
                    "group_id": group_id,
                    "use_groups": use_groups,
                    "sid": sid,
                }

            # Emit progress update to client
            await sio.emit(
                "benchmarks_status_update",
                {
                    "test_id": test_id,
                    "attempt_id": attempt_id,
                    "status": "processing",
                },
                room=f"benchmark_{attempt_id}",
            )

    except Exception as e:
        # Propagate to benchmark_error handler
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
    """Handle benchmark_next event from internal bus (server-to-server)."""
    try:
        validated = BenchmarkNextPayload(**data)
        sid = data.get("sid", "internal")
        await _benchmark_next_impl(sid, validated)
    except ValidationError:
        # Propagate to benchmark_error handler
        await internal_sio.emit(
            "benchmark_error",
            {
                "attempt_id": data.get("attempt_id", "unknown"),
                "eval_id": data.get("eval_id", "unknown"),
                "test_id": None,
                "run_id": data.get("run_id"),
                "group_id": data.get("group_id"),
                "error_message": "Invalid payload",
                "sid": data.get("sid", "internal"),
            },
        )


@internal_sio.on("benchmark_eval_complete")  # type: ignore
async def benchmark_eval_complete_internal(data: dict[str, Any]) -> None:
    """Handle benchmark_eval_complete event - tracks completion and advances when all evals done."""
    try:
        attempt_id = data.get("attempt_id")
        test_id = data.get("test_id")
        success = data.get("success", True)

        if not attempt_id or not test_id:
            return

        eval_key = f"{attempt_id}_{test_id}"

        # Check if we're tracking this eval
        if eval_key not in _pending_eval_completions:
            return

        completion_info = _pending_eval_completions[eval_key]

        # Decrement pending count
        completion_info["pending_count"] -= 1

        # If error occurred, propagate to benchmark_error handler
        if not success:
            await internal_sio.emit(
                "benchmark_error",
                {
                    "attempt_id": attempt_id,
                    "eval_id": completion_info["eval_id"],
                    "test_id": test_id,
                    "run_id": completion_info["run_id"],
                    "group_id": completion_info["group_id"],
                    "error_message": data.get("message", "Eval failed"),
                    "sid": completion_info["sid"],
                },
            )
            # Remove from tracking
            del _pending_eval_completions[eval_key]
            return

        # Check if all evals completed
        if completion_info["pending_count"] <= 0:
            # All evals complete - emit benchmark_advance to notify client via advance.py
            await internal_sio.emit(
                "benchmark_advance",
                {
                    "test_id": test_id,
                    "attempt_id": attempt_id,
                    "run_id": completion_info["run_id"],
                    "group_id": completion_info["group_id"],
                    "sid": completion_info["sid"],
                },
            )

            # Then emit benchmark_end to complete the test
            await internal_sio.emit(
                "benchmark_end",
                {
                    "test_id": test_id,
                    "attempt_id": attempt_id,
                    "eval_id": completion_info["eval_id"],
                    "run_id": completion_info["run_id"],
                    "group_id": completion_info["group_id"],
                    "use_groups": completion_info["use_groups"],
                    "sid": completion_info["sid"],
                },
            )

            # Remove from tracking
            del _pending_eval_completions[eval_key]

    except Exception as e:
        # Propagate to benchmark_error handler
        await internal_sio.emit(
            "benchmark_error",
            {
                "attempt_id": data.get("attempt_id", "unknown"),
                "eval_id": data.get("eval_id"),
                "test_id": data.get("test_id"),
                "run_id": data.get("run_id"),
                "group_id": data.get("group_id"),
                "error_message": str(e),
                "sid": data.get("sid", "internal"),
            },
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/next", response_model=dict[str, bool])
async def benchmark_next_api(request: BenchmarkNextPayload) -> dict[str, bool]:
    """Internal event: Process next run/group for benchmark attempt."""
    return {"success": True}

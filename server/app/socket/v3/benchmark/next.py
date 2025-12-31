"""Handler for benchmark_next WebSocket event - orchestrates section-by-section execution."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, get_pool, sio

logger = get_logger(__name__)
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


# State tracking for sequential execution
_pending_completions: dict[str, dict[str, Any]] = {}


async def _benchmark_next_impl(sid: str, data: BenchmarkNextPayload) -> None:
    """
    Handle benchmark_next requests via WebSocket.
    Orchestrates section-by-section execution: tools first, then agents.
    """
    try:
        logger.info(
            f"Received benchmark_next request from {sid} with data: {data}"
        )

        attempt_id = data.attempt_id
        eval_id = data.eval_id
        run_id = data.run_id
        group_id = data.group_id
        use_groups = data.use_groups

        if not attempt_id or not eval_id:
            logger.error(f"Missing attempt_id or eval_id in benchmark_next")
            return

        # Get connection pool
        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            return

        async with pool.acquire() as conn:
            attempt_id_uuid = uuid.UUID(attempt_id)
            eval_id_uuid = uuid.UUID(eval_id)

            # Get attempt data (infinite_mode)
            attempt_row = await conn.fetchrow(
                "SELECT infinite_mode FROM eval_attempts WHERE id = $1::uuid",
                attempt_id_uuid,
            )
            if not attempt_row:
                logger.error(f"Attempt {attempt_id} not found")
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
                sql = load_sql("app/sql/v3/benchmark/get_group_stop_tools.sql")
                group_stop_rows = await conn.fetch(sql, group_id_uuid)
                group_stop_tools = [
                    {"tool_id": str(row["tool_id"]), "position_idx": row["position_idx"]}
                    for row in group_stop_rows
                ]

                # Get group_order agents
                sql = load_sql("app/sql/v3/benchmark/get_group_order_agents.sql")
                group_order_rows = await conn.fetch(sql, group_id_uuid)
                group_order_agents = [
                    {"agent_id": str(row["agent_id"]), "position_idx": row["position_idx"]}
                    for row in group_order_rows
                ]

            # Execute tools first (if any)
            # Note: Sequential execution - each tool completes before next starts
            # Completion events are handled by listeners that track pending completions
            if group_stop_tools:
                for tool_info in sorted(group_stop_tools, key=lambda x: x["position_idx"]):
                    tool_id = tool_info["tool_id"]
                    # Get tool name from tool_id to determine which eval handler to call
                    tool_row = await conn.fetchrow(
                        "SELECT name FROM tools WHERE id = $1::uuid",
                        uuid.UUID(tool_id),
                    )
                    if tool_row:
                        # Convert tool name to event name format (lowercase, underscores)
                        tool_name = tool_row["name"].lower().replace(" ", "_").replace("-", "_")
                        # Emit to specific tool eval handler (e.g., classification_eval_start, hint_eval_start)
                        await emit_to_internal(
                            f"{tool_name}_eval_start",
                            {
                                "test_id": test_id,
                                "attempt_id": attempt_id,
                                "eval_id": eval_id,
                                "run_id": run_id,
                                "group_id": group_id,
                                "tool_id": tool_id,
                                "use_groups": use_groups,
                            },
                            sid=sid,
                        )
                        # Note: Completion is handled asynchronously via event listeners
                        # The tool's eval.py will emit {tool_name}_eval_complete when done
                    else:
                        logger.warning(f"Tool {tool_id} not found, skipping")

            # Note: Stopping condition logic removed - tools execute sequentially

            # Execute agents (if not stopped)
            # Note: Sequential execution - each agent completes before next starts
            if group_order_agents:
                for agent_info in sorted(group_order_agents, key=lambda x: x["position_idx"]):
                    agent_id = agent_info["agent_id"]
                    # Get agent name from agent_id to determine which eval handler to call
                    agent_row = await conn.fetchrow(
                        "SELECT name FROM agents WHERE id = $1::uuid",
                        uuid.UUID(agent_id),
                    )
                    if agent_row:
                        # Convert agent name to event name format (lowercase, underscores)
                        agent_name = agent_row["name"].lower().replace(" ", "_").replace("-", "_")
                        # Emit to specific agent eval handler (e.g., simulation_eval_start, voice_eval_start)
                        await emit_to_internal(
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
                            },
                            sid=sid,
                        )
                        # Note: Completion is handled asynchronously via event listeners
                        # The agent's eval.py will emit {agent_name}_eval_complete when done
                    else:
                        logger.warning(f"Agent {agent_id} not found, skipping")

            # After agents, emit benchmark_end to complete the test
            # Note: Cycle counting and infinite mode logic removed
            await emit_to_internal(
                "benchmark_end",
                {
                    "test_id": test_id,
                    "attempt_id": attempt_id,
                    "eval_id": eval_id,
                    "run_id": run_id,
                    "group_id": group_id,
                    "use_groups": use_groups,
                },
                sid=sid,
            )

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
        logger.error(f"Error in benchmark_next for {sid}: {str(e)}", exc_info=True)


@internal_sio.on("benchmark_next")  # type: ignore
async def benchmark_next_internal(data: dict[str, Any]) -> None:
    """Handle benchmark_next event from internal bus (server-to-server)."""
    try:
        validated = BenchmarkNextPayload(**data)
        sid = data.get("sid", "internal")
        await _benchmark_next_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in benchmark_next_internal: {e}")


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/next", response_model=dict[str, bool])
async def benchmark_next_api(request: BenchmarkNextPayload) -> dict[str, bool]:
    """Internal event: Process next run/group for benchmark attempt."""
    return {"success": True}


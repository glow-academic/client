"""Handler for rubric_eval_start WebSocket event - eval-specific logic for rubric agent."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_client_endpoint
from app.main import get_internal_sio
from app.sql.types import (
    RubricEvalStartApiRequest,
    RubricEvalStartSqlParams,
    RubricEvalStartSqlRow,
)

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v3/agents/rubric/rubric_eval_start_complete.sql"


async def _rubric_eval_impl(
    sid: str,
    data: RubricEvalStartApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle rubric_eval_start requests via WebSocket."""
    try:
        async with get_db_connection() as conn:
            params = RubricEvalStartSqlParams(
                **data.model_dump(),
                profile_id=profile_id,  # From sid lookup
                group_id=group_id,
            )
            result = cast(
                RubricEvalStartSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Get eval dynamic flag and rubric_grade_agent info
            eval_id_uuid = uuid.UUID(data.eval_id)
            eval_row = await conn.fetchrow(
                "SELECT dynamic FROM evals WHERE id = $1::uuid",
                eval_id_uuid,
            )
            dynamic = eval_row.get("dynamic", False) if eval_row else False

            # Get rubric_grade_agent to find agent being evaluated
            if dynamic and data.run_id:
                rga_row = await conn.fetchrow(
                    """
                    SELECT rga.agent_id::text as agent_id, rga.grade_agent_id::text as grade_agent_id
                    FROM rubric_grade_agents rga
                    JOIN eval_runs_rubric_grade_agents errga ON errga.rubric_grade_agent_id = rga.id
                    WHERE errga.eval_id = $1::uuid AND errga.run_id = $2::uuid
                    LIMIT 1
                    """,
                    eval_id_uuid,
                    uuid.UUID(data.run_id),
                )
                if rga_row:
                    agent_being_evaluated_id = rga_row["agent_id"]
                    # TODO: Get messages exclude last assistant, re-run agent, use output for grading
                    # For now, placeholder

            # Non-dynamic mode: Simply emit to agents/grade/generate.py
            # TODO: Implement actual grading agent call
            # For now, placeholder

            # Note: Cycle tracking removed - agents execute sequentially

            # Emit benchmark-level completion (not agent-specific)
            await internal_sio.emit(
                "benchmark_eval_complete",
                {
                    "test_id": data.test_id,
                    "attempt_id": data.attempt_id,
                    "eval_id": data.eval_id,
                    "run_id": data.run_id,
                    "group_id": data.group_id,
                    "agent_id": data.agent_id,
                    "tool_id": None,
                    "success": True,
                    "message": "Rubric eval completed successfully",
                                        "sid": sid,
                },
            )
    except RuntimeError:
        # Pool not initialized - propagate to benchmark_error handler
        await internal_sio.emit(
            "benchmark_error",
            {
                "attempt_id": data.attempt_id,
                "eval_id": data.eval_id,
                "test_id": data.test_id,
                "run_id": data.run_id,
                "group_id": data.group_id,
                "error_message": "Database connection pool not available",
                                    "sid": sid,
            },
        )
    except Exception as e:
        # Propagate to benchmark_error handler
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


@internal_sio.on("rubric_eval_start")  # type: ignore
async def rubric_eval_internal(data: dict[str, Any]) -> None:
    """Handle rubric_eval_start event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=RubricEvalStartApiRequest,
        handler=_rubric_eval_impl,  # type: ignore[arg-type]
        error_event_name="benchmark_error",
        error_response_type=None,  # Will be handled by benchmark_error handler
    )


register_client_endpoint(
    server_router,
    "/eval",
    RubricEvalStartApiRequest,
    "Execute rubric agent for eval",
)

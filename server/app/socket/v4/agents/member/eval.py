"""Handler for member_eval_start WebSocket event - eval-specific logic for member agent."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.main import get_internal_sio
from app.sql.types import (
    AgentsMemberMemberEvalStartApiRequest,
    AgentsMemberMemberEvalStartSqlParams,
    AgentsMemberMemberEvalStartSqlRow,
)

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/agents/agents_member_member_eval_start_complete.sql"


async def _member_eval_impl(
    sid: str,
    data: AgentsMemberMemberEvalStartApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle member_eval_start requests via WebSocket."""
    try:
        async with get_db_connection() as conn:
            params = AgentsMemberMemberEvalStartSqlParams(
                **data.model_dump(),
                profile_id=profile_id,  # From sid lookup
                group_id=group_id,
            )
            result = cast(
                AgentsMemberMemberEvalStartSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Get eval dynamic flag
            eval_id_uuid = uuid.UUID(data.eval_id)
            eval_row = await conn.fetchrow(
                "SELECT dynamic FROM evals WHERE id = $1::uuid",
                eval_id_uuid,
            )
            dynamic = eval_row.get("dynamic", False) if eval_row else False

            # TODO: Implement actual eval logic here
            # For now, placeholder

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
                    "message": "Member eval completed successfully",
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


@internal_sio.on("member_eval_start")  # type: ignore
async def member_eval_internal(data: dict[str, Any]) -> None:
    """Handle member_eval_start event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=AgentsMemberMemberEvalStartApiRequest,
        handler=_member_eval_impl,  # type: ignore[arg-type]
        error_event_name="benchmark_error",
        error_response_type=None,  # Will be handled by benchmark_error handler
    )


register_client_endpoint(
    server_router,
    "/eval",
    AgentsMemberMemberEvalStartApiRequest,
    "Execute member agent for eval",
)

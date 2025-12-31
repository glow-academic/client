"""Handler for voice_eval_start WebSocket event - eval-specific logic for voice agent."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_client_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from app.sql.types import (
    AgentsVoiceVoiceEvalStartApiRequest,
    AgentsVoiceVoiceEvalStartSqlParams,
    AgentsVoiceVoiceEvalStartSqlRow,
)

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v3/agents/agents_voice_voice_eval_start_complete.sql"


async def _voice_eval_impl(
    sid: str,
    data: AgentsVoiceVoiceEvalStartApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle voice_eval_start requests via WebSocket."""
    try:
        async with get_db_connection() as conn:
            params = AgentsVoiceVoiceEvalStartSqlParams(
                **data.model_dump(),
                profile_id=profile_id,  # From sid lookup
                group_id=group_id,
            )
            result = cast(
                AgentsVoiceVoiceEvalStartSqlRow,
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
                    "message": "Voice eval completed successfully",
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


@internal_sio.on("voice_eval_start")  # type: ignore
async def voice_eval_internal(data: dict[str, Any]) -> None:
    """Handle voice_eval_start event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=AgentsVoiceVoiceEvalStartApiRequest,
        handler=_voice_eval_impl,  # type: ignore[arg-type]
        error_event_name="benchmark_error",
        error_response_type=None,  # Will be handled by benchmark_error handler
    )


register_client_endpoint(
    server_router,
    "/eval",
    AgentsVoiceVoiceEvalStartApiRequest,
    "Execute voice agent for eval",
)

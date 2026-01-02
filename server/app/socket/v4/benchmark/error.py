"""Handler for benchmark_error WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from app.sql.types import (
    BenchmarkErrorApiRequest,
    BenchmarkErrorSqlParams,
    BenchmarkErrorSqlRow,
)

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/benchmark/benchmark_error_complete.sql"


async def _benchmark_error_impl(
    sid: str,
    data: BenchmarkErrorApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation using typed SQL execution."""
    try:
        async with get_db_connection() as conn:
            params = BenchmarkErrorSqlParams(
                **data.model_dump(),
                profile_id=profile_id,  # From sid lookup
                group_id=group_id,
            )
            result = cast(
                BenchmarkErrorSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Emit error event to client using typed wrapper
            # Room is benchmark_{attempt_id} for proper scoping
            attempt_id = result.attempt_id
            room = f"benchmark_{attempt_id}" if attempt_id else sid
            await emit_to_client("benchmarks_error", result, room=room)
    except RuntimeError:
        # Pool not initialized - emit error event directly
        await emit_to_client(
            "benchmarks_error",
            BenchmarkErrorSqlRow(
                success=False,
                message="Database connection pool not available",
                attempt_id=data.attempt_id if hasattr(data, "attempt_id") else None,
                eval_id=data.eval_id if hasattr(data, "eval_id") else None,
                test_id=None,
                trace_id=None,
            ),
            room=sid,
        )


@internal_sio.on("benchmark_error")  # type: ignore
async def benchmark_error_internal(data: dict[str, Any]) -> None:
    """Handle benchmark_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=BenchmarkErrorApiRequest,
        handler=_benchmark_error_impl,  # type: ignore[arg-type]
        error_event_name="benchmarks_error",
        error_response_type=BenchmarkErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/error",
    BenchmarkErrorSqlRow,
    "Error occurred during benchmark execution",
)

"""Handler for benchmark_eval_complete WebSocket event - ONE EVENT PER FILE.

This handler processes benchmark_eval_complete events. The actual sequencing
is handled by next.py which also listens for benchmark_eval_complete events.
This handler can be used for logging, validation, or other processing.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio
from app.sql.types import (
    BenchmarkEvalCompleteApiRequest,
    BenchmarkEvalCompleteSqlParams,
    BenchmarkEvalCompleteSqlRow,
)

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/benchmark/benchmark_eval_complete_complete.sql"


async def _benchmark_eval_complete_impl(
    sid: str,
    data: BenchmarkEvalCompleteApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation using typed SQL execution."""
    try:
        async with get_db_connection() as conn:
            params = BenchmarkEvalCompleteSqlParams(
                **data.model_dump(),
                profile_id=profile_id,  # From sid lookup
                group_id=group_id,
            )
            result = cast(
                BenchmarkEvalCompleteSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Event is already emitted by eval.py files
            # next.py listens directly for benchmark_eval_complete events
            # This handler can be used for logging/processing if needed
            # No re-emission needed - event propagates naturally
    except RuntimeError:
        # Pool not initialized - emit error event directly
        await internal_sio.emit(
            "benchmark_error",
            {
                "attempt_id": data.attempt_id if hasattr(data, "attempt_id") else None,
                "eval_id": data.eval_id if hasattr(data, "eval_id") else None,
                "test_id": data.test_id if hasattr(data, "test_id") else None,
                "run_id": data.run_id if hasattr(data, "run_id") else None,
                "group_id": data.group_id if hasattr(data, "group_id") else None,
                "error_message": "Database connection pool not available",
                "sid": sid,
            },
        )


@internal_sio.on("benchmark_eval_complete")  # type: ignore
async def benchmark_eval_complete_internal(data: dict[str, Any]) -> None:
    """Handle benchmark_eval_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=BenchmarkEvalCompleteApiRequest,
        handler=_benchmark_eval_complete_impl,  # type: ignore[arg-type]
        error_event_name="benchmark_error",
        error_response_type=None,  # Will be handled by benchmark_error handler
    )


register_server_endpoint(
    server_router,
    "/eval_complete",
    BenchmarkEvalCompleteSqlRow,
    "Benchmark eval completed",
)

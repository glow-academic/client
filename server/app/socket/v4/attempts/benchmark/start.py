"""Handler for benchmark_start WebSocket event."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.main import get_internal_sio, sio
from app.sql.types import (
    StartBenchmarkAttemptSqlParams,
    StartBenchmarkAttemptSqlRow,
)

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/benchmark/start_benchmark_attempt_complete.sql"

internal_sio = get_internal_sio()
logger = get_logger(__name__)


# Pydantic models for server-to-client events
class BenchmarkStartErrorPayload(BaseModel):
    """Response indicating an error occurred while starting benchmark."""

    success: bool
    message: str


class BenchmarkStartedPayload(BaseModel):
    """Response indicating benchmark started successfully."""

    success: bool
    message: str
    attempt_id: str


# Pydantic model for client-to-server event
class BenchmarkStartPayload(BaseModel):
    """Request to start a benchmark attempt."""

    eval_id: str
    profile_id: str | None = None
    infinite_mode: bool = False


# Emit helper functions
async def benchmark_start_error(payload: BenchmarkStartErrorPayload, room: str) -> None:
    await sio.emit("benchmarks_start_error", payload.model_dump(), room=room)


async def benchmark_started(payload: BenchmarkStartedPayload, room: str) -> None:
    await sio.emit("benchmarks_started", payload.model_dump(), room=room)


async def _benchmark_start_impl(
    sid: str,
    data: BenchmarkStartPayload,
) -> None:
    """Handle benchmark start requests via WebSocket.

    Creates attempt only - does not auto-start runs.
    """
    try:
        eval_id = data.eval_id
        infinite_mode = data.infinite_mode

        # Validate eval_id is required
        if not eval_id:
            await benchmark_start_error(
                BenchmarkStartErrorPayload(
                    success=False, message="eval_id is required"
                ),
                room=sid,
            )
            return

        # Get connection pool
        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            # Create attempt and get eval data + pending runs/groups
            params = StartBenchmarkAttemptSqlParams(
                eval_id=uuid.UUID(eval_id),
                infinite_mode=infinite_mode,
            )
            result = cast(
                StartBenchmarkAttemptSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.attempt_id:
                await benchmark_start_error(
                    BenchmarkStartErrorPayload(
                        success=False,
                        message=f"Eval not found: {eval_id}",
                    ),
                    room=sid,
                )
                return

            attempt_id = result.attempt_id

            # Emit success event
            await benchmark_started(
                BenchmarkStartedPayload(
                    success=True,
                    message="Benchmark attempt created successfully",
                    attempt_id=attempt_id,
                ),
                room=sid,
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="benchmarks.started",
                    template="{{ actor.name }} started benchmark",
                    context={"attempt_id": attempt_id, "eval_id": eval_id},
                    endpoint="/socket/v4/benchmark/start",
                    error=False,
                )
            except Exception:
                pass
    except Exception as e:
        await benchmark_start_error(
            BenchmarkStartErrorPayload(
                success=False, message=f"Failed to start benchmark: {str(e)}"
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def benchmark_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = BenchmarkStartPayload(**data)
        await _benchmark_start_impl(sid, validated)
    except ValidationError as e:
        await benchmark_start_error(
            BenchmarkStartErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


register_client_endpoint(
    client_router,
    "/start",
    BenchmarkStartPayload,
    "Start a benchmark attempt",
)

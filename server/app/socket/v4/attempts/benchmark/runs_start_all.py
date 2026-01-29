"""Handler for benchmark_runs_start_all WebSocket event - starts all pending runs."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetBenchmarkRunsStartAllContextSqlParams,
    GetBenchmarkRunsStartAllContextSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
logger = get_logger(__name__)

SQL_PATH = (
    "app/sql/v4/queries/benchmark/get_benchmark_runs_start_all_context_complete.sql"
)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class BenchmarkRunsStartAllErrorPayload(BaseModel):
    """Response indicating an error occurred while starting runs."""

    success: bool
    message: str
    attempt_id: str


class BenchmarkRunsStartAllStartedPayload(BaseModel):
    """Response indicating runs started successfully."""

    success: bool
    message: str
    attempt_id: str
    started_count: int


# Pydantic model for client-to-server event
class BenchmarkRunsStartAllPayload(BaseModel):
    """Request to start all pending runs in a benchmark attempt."""

    attempt_id: str
    profile_id: str | None = None


# Emit helper functions
async def benchmark_runs_start_all_error(
    payload: BenchmarkRunsStartAllErrorPayload, room: str
) -> None:
    await sio.emit("benchmarks_runs_start_all_error", payload.model_dump(), room=room)


async def benchmark_runs_start_all_started(
    payload: BenchmarkRunsStartAllStartedPayload, room: str
) -> None:
    await sio.emit("benchmarks_runs_start_all_started", payload.model_dump(), room=room)


async def _benchmark_runs_start_all_impl(
    sid: str,
    data: BenchmarkRunsStartAllPayload,
) -> None:
    """Handle benchmark runs start all requests via WebSocket.

    Starts all pending runs by emitting benchmark_next for each one.
    """
    try:
        attempt_id = data.attempt_id

        # Validate required fields
        if not attempt_id:
            await benchmark_runs_start_all_error(
                BenchmarkRunsStartAllErrorPayload(
                    success=False,
                    message="attempt_id is required",
                    attempt_id="",
                ),
                room=sid,
            )
            return

        async with get_db_connection() as conn:
            attempt_id_uuid = uuid.UUID(attempt_id)

            # Get eval_id, use_groups, and all pending runs/groups
            params = GetBenchmarkRunsStartAllContextSqlParams(
                attempt_id=attempt_id_uuid,
            )
            result = cast(
                GetBenchmarkRunsStartAllContextSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.eval_id:
                await benchmark_runs_start_all_error(
                    BenchmarkRunsStartAllErrorPayload(
                        success=False,
                        message=f"Attempt not found: {attempt_id}",
                        attempt_id=attempt_id,
                    ),
                    room=sid,
                )
                return

            eval_id = result.eval_id
            use_groups = result.use_groups or False
            pending_ids = result.pending_ids or []

            # If no pending runs, return success with count 0
            if not pending_ids:
                await benchmark_runs_start_all_started(
                    BenchmarkRunsStartAllStartedPayload(
                        success=True,
                        message="No pending runs to start",
                        attempt_id=attempt_id,
                        started_count=0,
                    ),
                    room=sid,
                )
                return

            # Emit benchmark_next for each pending run/group
            from app.socket.v4.attempts.benchmark.next import BenchmarkNextPayload

            for pending_id in pending_ids:
                if use_groups:
                    await emit_to_internal(
                        "benchmark_next",
                        BenchmarkNextPayload(
                            attempt_id=attempt_id,
                            eval_id=eval_id,
                            run_id=None,
                            group_id=pending_id,
                            use_groups=True,
                        ),
                        sid=sid,
                    )
                else:
                    await emit_to_internal(
                        "benchmark_next",
                        BenchmarkNextPayload(
                            attempt_id=attempt_id,
                            eval_id=eval_id,
                            run_id=pending_id,
                            group_id=None,
                            use_groups=False,
                        ),
                        sid=sid,
                    )

            # Emit success event
            await benchmark_runs_start_all_started(
                BenchmarkRunsStartAllStartedPayload(
                    success=True,
                    message=f"Started {len(pending_ids)} run(s)",
                    attempt_id=attempt_id,
                    started_count=len(pending_ids),
                ),
                room=sid,
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="benchmarks.runs_start_all_started",
                    template="{{ actor.name }} started all pending benchmark runs",
                    context={
                        "attempt_id": attempt_id,
                        "eval_id": eval_id,
                        "started_count": len(pending_ids),
                    },
                    endpoint="/socket/v4/benchmark/runs_start_all",
                    error=False,
                )
            except Exception:
                pass

    except ValueError as e:
        # UUID parsing error
        await benchmark_runs_start_all_error(
            BenchmarkRunsStartAllErrorPayload(
                success=False,
                message=f"Invalid UUID format: {str(e)}",
                attempt_id=data.attempt_id,
            ),
            room=sid,
        )
    except Exception as e:
        await benchmark_runs_start_all_error(
            BenchmarkRunsStartAllErrorPayload(
                success=False,
                message=f"Failed to start runs: {str(e)}",
                attempt_id=data.attempt_id,
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def benchmark_runs_start_all(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = BenchmarkRunsStartAllPayload(**data)
        await _benchmark_runs_start_all_impl(sid, validated)
    except ValidationError as e:
        await benchmark_runs_start_all_error(
            BenchmarkRunsStartAllErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                attempt_id=data.get("attempt_id", ""),
            ),
            room=sid,
        )


register_client_endpoint(
    client_router,
    "/runs_start_all",
    BenchmarkRunsStartAllPayload,
    "Start all pending runs in a benchmark attempt",
)


# FastAPI endpoint for OpenAPI documentation
@server_router.post("/runs_start_all_started", response_model=dict[str, bool])
async def benchmark_runs_start_all_started_api(
    request: BenchmarkRunsStartAllStartedPayload,
) -> dict[str, bool]:
    """Server-to-client event: Runs started successfully."""
    return {"success": True}


@server_router.post("/runs_start_all_error", response_model=dict[str, bool])
async def benchmark_runs_start_all_error_api(
    request: BenchmarkRunsStartAllErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while starting runs."""
    return {"success": True}

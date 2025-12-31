"""Handler for benchmark_start WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.websocket.openapi_helpers import register_client_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, get_pool, sio

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v3/benchmark/start_benchmark_attempt_complete.sql"

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

    Creates attempt and checks for next pending run/group, then emits to next.py if found.
    """
    try:
        logger.info(f"Received benchmark_start request from {sid} with data: {data}")

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
        pool = get_pool()
        if not pool:
            await benchmark_start_error(
                BenchmarkStartErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Create attempt and get eval data + pending runs/groups
            sql = load_sql(SQL_PATH)
            result = await conn.fetchrow(sql, eval_id, infinite_mode)

            if not result:
                await benchmark_start_error(
                    BenchmarkStartErrorPayload(
                        success=False,
                        message=f"Eval not found: {eval_id}",
                    ),
                    room=sid,
                )
                return

            attempt_id = result["attempt_id"]
            use_groups = result.get("use_groups", False)
            pending_run_ids = result.get("pending_run_ids", []) or []
            pending_group_ids = result.get("pending_group_ids", []) or []

            # Emit success event
            await benchmark_started(
                BenchmarkStartedPayload(
                    success=True,
                    message="Benchmark attempt created successfully",
                    attempt_id=attempt_id,
                ),
                room=sid,
            )

            # If there's a next run/group, emit to next.py handler
            if use_groups:
                if pending_group_ids:
                    next_group_id = pending_group_ids[0]
                    logger.info(
                        f"Found next group {next_group_id} for attempt {attempt_id}, emitting to next.py"
                    )
                    await emit_to_internal(
                        "benchmark_next",
                        {
                            "attempt_id": attempt_id,
                            "eval_id": eval_id,
                            "group_id": str(next_group_id),
                            "use_groups": True,
                        },
                        sid=sid,
                    )
            else:
                if pending_run_ids:
                    next_run_id = pending_run_ids[0]
                    logger.info(
                        f"Found next run {next_run_id} for attempt {attempt_id}, emitting to next.py"
                    )
                    await emit_to_internal(
                        "benchmark_next",
                        {
                            "attempt_id": attempt_id,
                            "eval_id": eval_id,
                            "run_id": str(next_run_id),
                            "use_groups": False,
                        },
                        sid=sid,
                    )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="benchmarks.started",
                    template="{{ actor.name }} started benchmark",
                    context={"attempt_id": attempt_id, "eval_id": eval_id},
                    endpoint="/socket/v3/benchmark/start",
                    error=False,
                )
            except Exception as log_error:
                logger.warning(f"Error logging benchmark start activity: {log_error}")

    except Exception as e:
        logger.error(f"Error starting benchmark attempt for {sid}: {e}", exc_info=True)
        await benchmark_start_error(
            BenchmarkStartErrorPayload(
                success=False, message=f"Failed to start benchmark: {str(e)}"
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def benchmark_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = BenchmarkStartPayload(**data)
        await _benchmark_start_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in benchmark_start for {sid}: {e}")
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

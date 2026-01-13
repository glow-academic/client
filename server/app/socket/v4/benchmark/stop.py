"""Handler for benchmark_stop WebSocket event."""

import uuid
from typing import Any, cast

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.cancel_active_run import cancel_active_run
from app.main import sio
from app.sql.types import (GetTestDetailsV4SqlParams, GetTestDetailsV4SqlRow,
                           MarkTestCompleteV4SqlParams)
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class BenchmarkStopErrorPayload(BaseModel):
    """Response indicating an error occurred while stopping benchmark."""

    success: bool
    message: str


class BenchmarkStoppedPayload(BaseModel):
    """Response indicating benchmark was stopped successfully."""

    attempt_id: str
    success: bool
    message: str


# Pydantic model for client-to-server event
class BenchmarkStopPayload(BaseModel):
    """Request to stop a benchmark attempt."""

    attempt_id: str


# Emit helper functions
async def benchmark_stop_error(payload: BenchmarkStopErrorPayload, room: str) -> None:
    await sio.emit("benchmarks_stop_error", payload.model_dump(), room=room)


async def benchmark_stopped(payload: BenchmarkStoppedPayload, room: str) -> None:
    await sio.emit("benchmarks_stopped", payload.model_dump(), room=room)


async def _benchmark_stop_impl(sid: str, data: BenchmarkStopPayload) -> None:
    """
    Handle benchmark stop requests via WebSocket.
    Stops active run/group in benchmark attempt and cancels active operations.
    """
    try:
        attempt_id = data.attempt_id

        if not attempt_id:
            await benchmark_stop_error(
                BenchmarkStopErrorPayload(success=False, message="Missing attempt_id"),
                room=sid,
            )
            return

        # Get connection pool
        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            attempt_id_uuid = uuid.UUID(attempt_id)

            # Get active test for this attempt
            test_details_params = GetTestDetailsV4SqlParams(
                attempt_id=attempt_id_uuid
            )
            test_details_result = cast(
                GetTestDetailsV4SqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/benchmark/get_test_details_v4_complete.sql",
                    params=test_details_params,
                ),
            )
            active_test_row = {
                "test_id": test_details_result.test_id,
                "run_id": test_details_result.run_id,
            } if test_details_result else None

            if active_test_row:
                test_id = active_test_row["test_id"]
                run_id = active_test_row.get("run_id")

                # Cancel active run if exists
                if run_id:
                    await cancel_active_run(run_id)

                # Mark test as completed
                mark_params = MarkTestCompleteV4SqlParams(
                    test_id=uuid.UUID(test_id)
                )
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/benchmark/mark_test_complete_v4_complete.sql",
                    params=mark_params,
                )
            # Emit stop signal
            await benchmark_stopped(
                BenchmarkStoppedPayload(
                    attempt_id=attempt_id,
                    success=True,
                    message="Benchmark stopped successfully",
                ),
                room=f"benchmark_{attempt_id}",
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="benchmarks.stopped",
                    template="{{ actor.name }} stopped benchmark",
                    context={"attempt_id": attempt_id},
                    endpoint="/socket/v4/benchmark/stop",
                    error=False,
                )
            except Exception:
                pass
    except Exception as e:
        await benchmark_stop_error(
            BenchmarkStopErrorPayload(
                success=False, message=f"Failed to stop benchmark: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="benchmarks.stopped",
                template="{{ actor.name }} failed to stop benchmark",
                context={"error": str(e)},
                endpoint="/socket/v4/benchmark/stop",
                error=True,
            )
        except Exception:
            pass


@sio.event  # type: ignore
async def benchmark_stop(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = BenchmarkStopPayload(**data)
        await _benchmark_stop_impl(sid, validated)
    except ValidationError as e:
        await benchmark_stop_error(
            BenchmarkStopErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/stop", response_model=dict[str, bool])
async def benchmark_stop_api(request: BenchmarkStopPayload) -> dict[str, bool]:
    """Client-to-server event: Stop a benchmark attempt."""
    return {"success": True}


@server_router.post("/stopped", response_model=dict[str, bool])
async def benchmark_stopped_api(request: BenchmarkStoppedPayload) -> dict[str, bool]:
    """Server-to-client event: Benchmark stopped successfully."""
    return {"success": True}


@server_router.post("/stop_error", response_model=dict[str, bool])
async def benchmark_stop_error_api(
    request: BenchmarkStopErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while stopping benchmark."""
    return {"success": True}

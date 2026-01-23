"""Handler for benchmark_advance WebSocket event - updates client with test/run status."""

import uuid
from typing import Any, cast

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.sql.types import GetTestByIdV4SqlParams, GetTestByIdV4SqlRow
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class BenchmarkAdvancedPayload(BaseModel):
    """Response indicating benchmark advanced successfully."""

    success: bool
    message: str
    test_id: str
    run_id: str | None = None
    group_id: str | None = None
    attempt_id: str


class BenchmarkAdvanceErrorPayload(BaseModel):
    """Response indicating an error occurred in benchmark advance."""

    success: bool
    message: str


# Pydantic model for internal event
class BenchmarkAdvancePayload(BaseModel):
    """Request to update client with test/run status."""

    test_id: str
    attempt_id: str
    run_id: str | None = None
    group_id: str | None = None


# Emit helper functions
async def benchmark_advanced(payload: BenchmarkAdvancedPayload, room: str) -> None:
    await sio.emit("benchmarks_advanced", payload.model_dump(), room=room)


async def benchmark_advance_error(
    payload: BenchmarkAdvanceErrorPayload, room: str
) -> None:
    await sio.emit("benchmarks_advance_error", payload.model_dump(), room=room)


async def _benchmark_advance_impl(sid: str, data: BenchmarkAdvancePayload) -> None:
    """
    Handle benchmark_advance requests via WebSocket.
    Updates client with test/run/group status.
    """
    try:
        test_id = data.test_id
        attempt_id = data.attempt_id
        run_id = data.run_id
        group_id = data.group_id

        if not test_id or not attempt_id:
            await benchmark_advance_error(
                BenchmarkAdvanceErrorPayload(
                    success=False, message="Missing test_id or attempt_id"
                ),
                room=sid,
            )
            return

        # Get connection pool
        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            test_id_uuid = uuid.UUID(test_id)
            attempt_id_uuid = uuid.UUID(attempt_id)

            # Verify test exists
            test_params = GetTestByIdV4SqlParams(test_id=test_id_uuid)
            test_result = cast(
                GetTestByIdV4SqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/benchmark/get_test_by_id_v4_complete.sql",
                    params=test_params,
                ),
            )
            test_row = {
                "id": test_result.id,
                "title": test_result.title,
                "completed": test_result.completed,
            } if test_result else None
            if not test_row:
                await benchmark_advance_error(
                    BenchmarkAdvanceErrorPayload(
                        success=False, message="Test not found"
                    ),
                    room=sid,
                )
                return
            # Emit success event to client
            await benchmark_advanced(
                BenchmarkAdvancedPayload(
                    success=True,
                    message="Benchmark advanced successfully",
                    test_id=test_id,
                    run_id=run_id,
                    group_id=group_id,
                    attempt_id=attempt_id,
                ),
                room=sid,
            )

            # Also emit to benchmark room
            await benchmark_advanced(
                BenchmarkAdvancedPayload(
                    success=True,
                    message="Benchmark advanced successfully",
                    test_id=test_id,
                    run_id=run_id,
                    group_id=group_id,
                    attempt_id=attempt_id,
                ),
                room=f"benchmark_{attempt_id}",
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="benchmarks.advanced",
                    template="{{ actor.name }} advanced benchmark",
                    context={"test_id": test_id, "attempt_id": attempt_id},
                    endpoint="/socket/v4/benchmark/advance",
                    error=False,
                )
            except Exception:
                pass
    except Exception as e:
        await benchmark_advance_error(
            BenchmarkAdvanceErrorPayload(success=False, message=str(e)),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="benchmarks.advanced",
                template="{{ actor.name }} failed to advance benchmark",
                context={"error": str(e)},
                endpoint="/socket/v4/benchmark/advance",
                error=True,
            )
        except Exception:
            pass


@internal_sio.on("benchmark_advance")  # type: ignore
async def benchmark_advance_internal(data: dict[str, Any]) -> None:
    """Handle benchmark_advance event from internal bus (server-to-server)."""
    try:
        validated = BenchmarkAdvancePayload(**data)
        # Get sid from data if present, otherwise use a default
        sid = data.get("sid", "internal")
        await _benchmark_advance_impl(sid, validated)
    except ValidationError as e:
        await benchmark_advance_error(
            BenchmarkAdvanceErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=data.get("sid", "internal"),
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/advance", response_model=dict[str, bool])
async def benchmark_advance_api(request: BenchmarkAdvancePayload) -> dict[str, bool]:
    """Internal event: Update client with test/run status."""
    return {"success": True}


@server_router.post("/advance_error", response_model=dict[str, bool])
async def benchmark_advance_error_api(
    request: BenchmarkAdvanceErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in benchmark advance."""
    return {"success": True}


@server_router.post("/advanced", response_model=dict[str, bool])
async def benchmark_advanced_api(
    request: BenchmarkAdvancedPayload,
) -> dict[str, bool]:
    """Server-to-client event: Benchmark advanced successfully."""
    return {"success": True}

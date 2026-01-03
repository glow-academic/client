"""Handler for benchmark_run_start WebSocket event - starts individual run."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()
logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class BenchmarkRunStartErrorPayload(BaseModel):
    """Response indicating an error occurred while starting run."""

    success: bool
    message: str
    run_id: str


class BenchmarkRunStartedPayload(BaseModel):
    """Response indicating run started successfully."""

    success: bool
    message: str
    attempt_id: str
    run_id: str


# Pydantic model for client-to-server event
class BenchmarkRunStartPayload(BaseModel):
    """Request to start a specific run in a benchmark attempt."""

    attempt_id: str
    run_id: str
    profile_id: str | None = None


# Emit helper functions
async def benchmark_run_start_error(payload: BenchmarkRunStartErrorPayload, room: str) -> None:
    await sio.emit("benchmarks_run_start_error", payload.model_dump(), room=room)


async def benchmark_run_started(payload: BenchmarkRunStartedPayload, room: str) -> None:
    await sio.emit("benchmarks_run_started", payload.model_dump(), room=room)


async def _benchmark_run_start_impl(
    sid: str,
    data: BenchmarkRunStartPayload,
) -> None:
    """Handle benchmark run start requests via WebSocket.

    Starts a specific run by emitting benchmark_next internally.
    """
    try:
        attempt_id = data.attempt_id
        run_id = data.run_id

        # Validate required fields
        if not attempt_id:
            await benchmark_run_start_error(
                BenchmarkRunStartErrorPayload(
                    success=False,
                    message="attempt_id is required",
                    run_id=run_id or "",
                ),
                room=sid,
            )
            return

        if not run_id:
            await benchmark_run_start_error(
                BenchmarkRunStartErrorPayload(
                    success=False,
                    message="run_id is required",
                    run_id="",
                ),
                room=sid,
            )
            return

        async with get_db_connection() as conn:
            attempt_id_uuid = uuid.UUID(attempt_id)
            run_id_uuid = uuid.UUID(run_id)

            # Get eval_id, use_groups, and verify run belongs to attempt's eval
            result = await conn.fetchrow(
                """
                SELECT 
                    e.id::text as eval_id,
                    e.use_groups,
                    er.run_id::uuid as run_id,
                    er.completed as run_completed
                FROM eval_attempts ea
                JOIN evals e ON e.id = ea.eval_id
                LEFT JOIN eval_runs er ON er.eval_id = e.id AND er.run_id = $1::uuid
                WHERE ea.id = $2::uuid
                """,
                run_id_uuid,
                attempt_id_uuid,
            )

            if not result:
                await benchmark_run_start_error(
                    BenchmarkRunStartErrorPayload(
                        success=False,
                        message=f"Attempt not found: {attempt_id}",
                        run_id=run_id,
                    ),
                    room=sid,
                )
                return

            eval_id = result.get("eval_id")
            use_groups = result.get("use_groups", False)
            found_run_id = result.get("run_id")
            run_completed = result.get("run_completed")

            if not eval_id:
                await benchmark_run_start_error(
                    BenchmarkRunStartErrorPayload(
                        success=False,
                        message=f"Eval not found for attempt: {attempt_id}",
                        run_id=run_id,
                    ),
                    room=sid,
                )
                return

            # Verify run belongs to this eval
            if not found_run_id:
                await benchmark_run_start_error(
                    BenchmarkRunStartErrorPayload(
                        success=False,
                        message=f"Run {run_id} does not belong to this eval",
                        run_id=run_id,
                    ),
                    room=sid,
                )
                return

            # Verify run is not already completed
            if run_completed:
                await benchmark_run_start_error(
                    BenchmarkRunStartErrorPayload(
                        success=False,
                        message=f"Run {run_id} is already completed",
                        run_id=run_id,
                    ),
                    room=sid,
                )
                return

            # Emit success event
            await benchmark_run_started(
                BenchmarkRunStartedPayload(
                    success=True,
                    message="Run started successfully",
                    attempt_id=attempt_id,
                    run_id=run_id,
                ),
                room=sid,
            )

            # Emit benchmark_next internally to start the run
            await emit_to_internal(
                "benchmark_next",
                {
                    "attempt_id": attempt_id,
                    "eval_id": eval_id,
                    "run_id": run_id,
                    "group_id": None,
                    "use_groups": use_groups,
                },
                sid=sid,
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="benchmarks.run_started",
                    template="{{ actor.name }} started benchmark run",
                    context={"attempt_id": attempt_id, "eval_id": eval_id, "run_id": run_id},
                    endpoint="/socket/v4/benchmark/run_start",
                    error=False,
                )
            except Exception as log_error:
                pass

    except ValueError as e:
        # UUID parsing error
        await benchmark_run_start_error(
            BenchmarkRunStartErrorPayload(
                success=False,
                message=f"Invalid UUID format: {str(e)}",
                run_id=data.run_id,
            ),
            sid=sid,
        )
    except Exception as e:
        await benchmark_run_start_error(
            BenchmarkRunStartErrorPayload(
                success=False,
                message=f"Failed to start run: {str(e)}",
                run_id=data.run_id,
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def benchmark_run_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = BenchmarkRunStartPayload(**data)
        await _benchmark_run_start_impl(sid, validated)
    except ValidationError as e:
        await benchmark_run_start_error(
            BenchmarkRunStartErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                run_id=data.get("run_id", ""),
            ),
            room=sid,
        )


register_client_endpoint(
    client_router,
    "/run_start",
    BenchmarkRunStartPayload,
    "Start a specific run in a benchmark attempt",
)


# FastAPI endpoint for OpenAPI documentation
@server_router.post("/run_started", response_model=dict[str, bool])
async def benchmark_run_started_api(
    request: BenchmarkRunStartedPayload,
) -> dict[str, bool]:
    """Server-to-client event: Run started successfully."""
    return {"success": True}


@server_router.post("/run_start_error", response_model=dict[str, bool])
async def benchmark_run_start_error_api(
    request: BenchmarkRunStartErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while starting run."""
    return {"success": True}


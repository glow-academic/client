"""Benchmark start handler.

Single entry point for benchmark orchestration:
- Creates attempt
- Emits benchmarks_started
- Auto-starts all pending runs/groups via internal benchmark_next
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.benchmark.permissions import (
    BenchmarkGenerationContext,
    validate_benchmark_access,
)
from app.socket.v4.artifacts.benchmark.types import (
    BenchmarkErrorEvent,
    BenchmarkNextPayload,
    BenchmarkStartedEvent,
    BenchmarkStartPayload,
)
from app.sql.types import StartBenchmarkAttemptSqlParams, StartBenchmarkAttemptSqlRow
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_START = "app/sql/v4/queries/benchmark/start_benchmark_attempt_complete.sql"


async def _benchmark_start_impl(
    sid: str, data: BenchmarkStartPayload, profile_id: uuid.UUID
) -> None:
    """Handle benchmark_start with internal orchestration."""
    try:
        async with get_db_connection() as conn:
            params = StartBenchmarkAttemptSqlParams(
                eval_id=data.eval_id,
                infinite_mode=data.infinite_mode,
            )
            result = cast(
                StartBenchmarkAttemptSqlRow,
                await execute_sql_typed(conn, SQL_PATH_START, params=params),
            )

            ctx = BenchmarkGenerationContext(
                eval_id=data.eval_id,
                eval_exists=bool(result and result.eval_id),
            )
            is_valid, failures = validate_benchmark_access(ctx)
            if not is_valid or not result or not result.attempt_id:
                message = (
                    "; ".join(failures)
                    if failures
                    else f"Eval not found: {data.eval_id}"
                )
                await sio.emit(
                    "benchmarks_error",
                    BenchmarkErrorEvent(message=message).model_dump(mode="json"),
                    room=sid,
                )
                return

            pending_run_ids = [
                str(run_id) for run_id in (result.pending_run_ids or [])
            ]
            pending_group_ids = [
                str(group_id) for group_id in (result.pending_group_ids or [])
            ]

            started_event = BenchmarkStartedEvent(
                message="Benchmark attempt created successfully",
                attempt_id=str(result.attempt_id),
                eval_id=result.eval_id,
                use_groups=result.use_groups or False,
                pending_run_ids=pending_run_ids,
                pending_group_ids=pending_group_ids,
            )

            await sio.emit(
                "benchmarks_started",
                started_event.model_dump(mode="json"),
                room=sid,
            )

            use_groups = result.use_groups or False
            pending_ids = pending_group_ids if use_groups else pending_run_ids

            for pending_id in pending_ids:
                await emit_to_internal(
                    "benchmark_next",
                    BenchmarkNextPayload(
                        attempt_id=str(result.attempt_id),
                        eval_id=str(result.eval_id),
                        run_id=None if use_groups else pending_id,
                        group_id=pending_id if use_groups else None,
                        use_groups=use_groups,
                    ),
                    sid=sid,
                )

    except Exception as e:
        logger.exception(f"Failed to start benchmark: {str(e)}")
        await sio.emit(
            "benchmarks_error",
            BenchmarkErrorEvent(message=f"Failed to start benchmark: {str(e)}").model_dump(
                mode="json"
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def benchmark_start(sid: str, data: dict[str, Any]) -> None:
    """Handle benchmark_start event (client-to-server)."""
    try:
        payload = BenchmarkStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await sio.emit(
                "benchmarks_error",
                BenchmarkErrorEvent(message="Profile not found. Please reconnect.").model_dump(
                    mode="json"
                ),
                room=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _benchmark_start_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in benchmark_start: {str(e)}")
        await sio.emit(
            "benchmarks_error",
            BenchmarkErrorEvent(message=f"Invalid request: {str(e)}").model_dump(
                mode="json"
            ),
            room=sid,
        )


@internal_sio.on("benchmark_start")  # type: ignore
async def benchmark_start_internal(data: dict[str, Any]) -> None:
    """Handle benchmark_start event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await sio.emit(
                "benchmarks_error",
                BenchmarkErrorEvent(message="Profile not found. Please reconnect.").model_dump(
                    mode="json"
                ),
                room=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        payload = BenchmarkStartPayload(**data)
        await _benchmark_start_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in benchmark_start_internal: {str(e)}")
        sid = data.get("sid", "")
        if sid:
            await sio.emit(
                "benchmarks_error",
                BenchmarkErrorEvent(message=f"Invalid request: {str(e)}").model_dump(
                    mode="json"
                ),
                room=sid,
            )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/benchmark/start", response_model=dict[str, bool])
async def benchmark_start_api(request: BenchmarkStartPayload) -> dict[str, bool]:
    """Client-to-server event: Start a benchmark attempt."""
    return {"success": True}


@server_router.post("/benchmark/started", response_model=dict[str, bool])
async def benchmark_started_api(request: BenchmarkStartedEvent) -> dict[str, bool]:
    """Server-to-client event: Benchmark attempt created successfully."""
    return {"success": True}

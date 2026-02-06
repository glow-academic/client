"""Benchmark start handler.

Creates benchmark attempt structure and returns it to client.
Client controls test execution via test/run.py handlers.

Entry point for benchmark:
- Creates benchmark_tests_entry (attempt)
- Creates benchmark_chats_entry for each run/group
- Returns structure to client
- Does NOT auto-trigger any test runs
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.benchmark.permissions import (
    BenchmarkGenerationContext,
    validate_benchmark_access,
)
from app.socket.v4.artifacts.benchmark.types import (
    BenchmarkChatInfo,
    BenchmarkErrorEvent,
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

SQL_PATH_START = "app/sql/v4/queries/generate/benchmark/start_benchmark_attempt_complete.sql"


async def _benchmark_start_impl(
    sid: str, data: BenchmarkStartPayload, profile_id: uuid.UUID
) -> None:
    """Handle benchmark_start - create structure and return to client.

    This function:
    1. Creates benchmark_tests_entry (attempt)
    2. Creates benchmark_chats_entry for each run/group
    3. Returns structure with chat_ids for client to control
    """
    try:
        async with get_db_connection() as conn:
            params = StartBenchmarkAttemptSqlParams(
                p_profile_id=profile_id,
                p_eval_id=data.eval_id,
                p_infinite_mode=data.infinite_mode,
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
                    "benchmark_error",
                    BenchmarkErrorEvent(message=message).model_dump(mode="json"),
                    room=sid,
                )
                return

            # Build chat info list from SQL result
            chats: list[BenchmarkChatInfo] = []
            if result.chats:
                for chat_data in result.chats:
                    chats.append(
                        BenchmarkChatInfo(
                            chat_id=str(chat_data.get("chat_id")),
                            run_resource_id=str(chat_data.get("run_resource_id"))
                            if chat_data.get("run_resource_id")
                            else None,
                            group_resource_id=str(chat_data.get("group_resource_id"))
                            if chat_data.get("group_resource_id")
                            else None,
                            status="pending",
                            total_runs=chat_data.get("total_runs", 1),
                            completed_runs=0,
                        )
                    )

            started_event = BenchmarkStartedEvent(
                message="Benchmark attempt created",
                attempt_id=str(result.attempt_id),
                eval_id=str(result.eval_id),
                use_groups=result.use_groups or False,
                chats=chats,
            )

            await sio.emit(
                "benchmark_started",
                started_event.model_dump(mode="json"),
                room=sid,
            )

            logger.info(
                f"Benchmark started - attempt_id={result.attempt_id}, "
                f"eval_id={result.eval_id}, chats={len(chats)}"
            )

    except Exception as e:
        logger.exception(f"Failed to start benchmark: {str(e)}")
        await sio.emit(
            "benchmark_error",
            BenchmarkErrorEvent(message=f"Failed to start benchmark: {str(e)}").model_dump(
                mode="json"
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def benchmark_start(sid: str, data: dict[str, Any]) -> None:
    """Handle benchmark_start event (client-to-server).

    Creates benchmark attempt structure and returns it.
    Client then controls test execution via test_run/test_run_all.
    """
    try:
        payload = BenchmarkStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await sio.emit(
                "benchmark_error",
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
            "benchmark_error",
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
                "benchmark_error",
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
                "benchmark_error",
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

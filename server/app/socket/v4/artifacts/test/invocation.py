"""Test invocation handler.

Creates benchmark invocations for a test and emits benchmark_started to client.
Triggered internally after benchmark/start.py creates the test entry.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.benchmark.types import (
    BenchmarkChatInfo,
    BenchmarkErrorEvent,
    BenchmarkStartedEvent,
)
from app.sql.types import CreateTestInvocationsSqlParams, CreateTestInvocationsSqlRow
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()

SQL_PATH_CREATE_INVOCATIONS = (
    "app/sql/v4/queries/generate/test/create_test_invocations_complete.sql"
)


@internal_sio.on("test_invocation")  # type: ignore
async def handle_test_invocation(data: dict[str, Any]) -> None:
    """Handle test_invocation internal event - create invocations and emit benchmark_started.

    Receives:
        sid: Socket ID for routing responses
        attempt_id: Test UUID string
        eval_id: Eval UUID string
    """
    sid = data.get("sid", "")
    if not sid:
        return

    try:
        attempt_id = uuid.UUID(data["attempt_id"])
        eval_id = uuid.UUID(data["eval_id"])

        async with get_db_connection() as conn:
            params = CreateTestInvocationsSqlParams(
                p_test_id=attempt_id,
                p_eval_id=eval_id,
            )
            result = cast(
                CreateTestInvocationsSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_CREATE_INVOCATIONS, params=params
                ),
            )

            # Build chat info list from SQL result
            chats: list[BenchmarkChatInfo] = []
            if result and result.chats:
                for chat_data in result.chats:
                    chats.append(
                        BenchmarkChatInfo(
                            chat_id=str(chat_data.get("chat_id")),
                            run_resource_id=str(chat_data.get("run_resource_id"))
                            if chat_data.get("run_resource_id")
                            else None,
                            group_resource_id=str(
                                chat_data.get("group_resource_id")
                            )
                            if chat_data.get("group_resource_id")
                            else None,
                            status="pending",
                            total_runs=chat_data.get("total_runs", 1),
                            completed_runs=0,
                        )
                    )

            started_event = BenchmarkStartedEvent(
                message="Benchmark attempt created",
                attempt_id=str(attempt_id),
                eval_id=str(eval_id),
                use_groups=result.use_groups or False if result else False,
                chats=chats,
            )

            await sio.emit(
                "benchmark_started",
                started_event.model_dump(mode="json"),
                room=sid,
            )

            logger.info(
                f"Test invocations created - attempt_id={attempt_id}, "
                f"eval_id={eval_id}, chats={len(chats)}"
            )

    except Exception as e:
        logger.exception(f"Failed to create test invocations: {str(e)}")
        await sio.emit(
            "benchmark_error",
            BenchmarkErrorEvent(
                message=f"Failed to create test invocations: {str(e)}"
            ).model_dump(mode="json"),
            room=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/test/invocation/started", response_model=dict[str, bool])
async def test_invocation_started_api(
    request: BenchmarkStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Test invocations created, benchmark started."""
    return {"success": True}

"""Test invocation handler.

Creates benchmark invocations for a test and emits benchmark_started to client.
Triggered internally after benchmark/start.py creates the test entry.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
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

            await sio.emit(
                "benchmark_started",
                {
                    "artifact_type": "benchmark",
                    "test_id": str(attempt_id),
                    "invocation_id": str(result.chats[0].get("chat_id"))
                    if result and result.chats
                    else None,
                },
                room=sid,
            )

            logger.info(
                f"Test invocations created - test_id={attempt_id}, eval_id={eval_id}"
            )

    except Exception as e:
        logger.exception(f"Failed to create test invocations: {str(e)}")
        await sio.emit(
            "benchmark_error",
            {
                "artifact_type": "benchmark",
                "success": False,
                "message": f"Failed to create test invocations: {str(e)}",
            },
            room=sid,
        )

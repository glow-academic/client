"""Test control handler.

Handles WebSocket events for stopping benchmark tests:
- test_stop: Stop current benchmark test
"""

from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio
from app.socket.v4.artifacts.test.types import TestErrorEvent, TestStopPayload, TestStoppedEvent
from app.sql.types import (
    GetTestDetailsV4SqlParams,
    GetTestDetailsV4SqlRow,
    MarkTestCompleteV4SqlParams,
)
from app.utils.sql_helper import execute_sql_typed

client_router = APIRouter()
server_router = APIRouter()


async def _test_stop_impl(sid: str, data: TestStopPayload) -> None:
    """Handle test_stop - mark active benchmark test complete."""
    try:
        attempt_id = str(data.attempt_id)
        if not attempt_id:
            await sio.emit(
                "test_error",
                TestErrorEvent(message="Missing attempt_id", error_type="stop").model_dump(
                    mode="json"
                ),
                room=sid,
            )
            return

        async with get_db_connection() as conn:
            params = GetTestDetailsV4SqlParams(attempt_id=data.attempt_id)
            result = cast(
                GetTestDetailsV4SqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/benchmark/get_test_details_v4_complete.sql",
                    params=params,
                ),
            )

            if not result or not result.test_id:
                await sio.emit(
                    "test_error",
                    TestErrorEvent(
                        attempt_id=attempt_id,
                        message="No active test found",
                        error_type="stop",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            mark_params = MarkTestCompleteV4SqlParams(test_id=result.test_id)
            await execute_sql_typed(
                conn,
                "app/sql/v4/queries/benchmark/mark_test_complete_v4_complete.sql",
                params=mark_params,
            )

        await sio.emit(
            "test_stopped",
            TestStoppedEvent(
                attempt_id=attempt_id,
                success=True,
                message="Benchmark test stopped",
            ).model_dump(mode="json"),
            room=sid,
        )
        await sio.emit(
            "test_stopped",
            TestStoppedEvent(
                attempt_id=attempt_id,
                success=True,
                message="Benchmark test stopped",
            ).model_dump(mode="json"),
            room=f"benchmark_{attempt_id}",
        )
    except Exception as e:
        await sio.emit(
            "test_error",
            TestErrorEvent(
                attempt_id=str(data.attempt_id),
                message=f"Failed to stop test: {str(e)}",
                error_type="stop",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def test_stop(sid: str, data: dict[str, Any]) -> None:
    """Handle test_stop event."""
    try:
        payload = TestStopPayload(**data)
        await _test_stop_impl(sid, payload)
    except Exception as e:
        await sio.emit(
            "test_error",
            TestErrorEvent(
                attempt_id=data.get("attempt_id"),
                message=f"Invalid request: {str(e)}",
                error_type="stop",
            ).model_dump(mode="json"),
            room=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/test/stop", response_model=dict[str, bool])
async def test_stop_api(request: TestStopPayload) -> dict[str, bool]:
    """Client-to-server event: Stop current benchmark test."""
    return {"success": True}


@server_router.post("/test/stopped", response_model=dict[str, bool])
async def test_stopped_api(request: TestStoppedEvent) -> dict[str, bool]:
    """Server-to-client event: Benchmark test stopped."""
    return {"success": True}

"""Handler for benchmark_enter WebSocket event."""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.main import get_pool, sio

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class BenchmarkEnterResponsePayload(BaseModel):
    """Response indicating successfully updated test created_at timestamp."""

    success: bool
    message: str
    test_id: str


class BenchmarkEnterErrorPayload(BaseModel):
    """Response indicating an error occurred while updating test created_at timestamp."""

    success: bool
    message: str


# Pydantic model for client-to-server event
class BenchmarkEnterPayload(BaseModel):
    """Request to update test created_at timestamp when entering a test."""

    test_id: str
    created_at: str  # ISO format datetime string


# Emit helper functions
async def benchmark_enter_response(
    payload: BenchmarkEnterResponsePayload, room: str
) -> None:
    await sio.emit("benchmarks_enter_response", payload.model_dump(), room=room)


async def benchmark_enter_error(payload: BenchmarkEnterErrorPayload, room: str) -> None:
    await sio.emit("benchmarks_enter_error", payload.model_dump(), room=room)


async def _benchmark_enter_impl(sid: str, data: BenchmarkEnterPayload) -> None:
    """Update test created_at timestamp when entering a test."""
    try:
        test_id = data.test_id
        created_at_str = data.created_at

        if not test_id:
            await benchmark_enter_error(
                BenchmarkEnterErrorPayload(
                    success=False, message="Missing test_id in request"
                ),
                room=sid,
            )
            return

        # Parse ISO datetime string
        try:
            created_at_dt = datetime.fromisoformat(
                created_at_str.replace("Z", "+00:00")
            )
            if created_at_dt.tzinfo is None:
                created_at_dt = created_at_dt.replace(tzinfo=UTC)
        except (ValueError, AttributeError) as e:
            await benchmark_enter_error(
                BenchmarkEnterErrorPayload(
                    success=False, message=f"Invalid created_at format: {str(e)}"
                ),
                room=sid,
            )
            return

        # Get connection pool
        pool = get_pool()
        if not pool:
            await benchmark_enter_error(
                BenchmarkEnterErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Update test created_at timestamp
            sql_update_test = load_sql(
                "app/sql/v3/benchmark/update_test_created_at.sql"
            )
            result = await conn.fetchrow(sql_update_test, created_at_dt, test_id)

            if result and result.get("test_id"):
                logger.info(
                    f"Updated created_at timestamp for test {test_id} from client {sid}"
                )
                await benchmark_enter_response(
                    BenchmarkEnterResponsePayload(
                        success=True,
                        message="Test created_at timestamp updated successfully",
                        test_id=test_id,
                    ),
                    room=sid,
                )
                # Log activity
                try:
                    await log_websocket_activity(
                        sid=sid,
                        event_key="benchmarks.entered",
                        template="{{ actor.name }} entered benchmark test",
                        context={"test_id": test_id},
                        endpoint="/socket/v3/benchmark/enter",
                        error=False,
                    )
                except Exception as log_error:
                    logger.warning(
                        f"Error logging benchmark enter activity: {log_error}"
                    )
            else:
                await benchmark_enter_error(
                    BenchmarkEnterErrorPayload(
                        success=False, message=f"Test {test_id} not found"
                    ),
                    room=sid,
                )

    except Exception as e:
        logger.error(
            f"Error updating test created_at timestamp for {sid}: {e}", exc_info=True
        )
        await benchmark_enter_error(
            BenchmarkEnterErrorPayload(
                success=False, message=f"Failed to update test timestamp: {str(e)}"
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def benchmark_enter(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = BenchmarkEnterPayload(**data)
        await _benchmark_enter_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in benchmark_enter for {sid}: {e}")
        await benchmark_enter_error(
            BenchmarkEnterErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/enter", response_model=dict[str, bool])
async def benchmark_enter_api(request: BenchmarkEnterPayload) -> dict[str, bool]:
    """Client-to-server event: Update test created_at timestamp when entering a test."""
    return {"success": True}


@server_router.post("/enter_response", response_model=dict[str, bool])
async def benchmark_enter_response_api(
    request: BenchmarkEnterResponsePayload,
) -> dict[str, bool]:
    """Server-to-client event: Successfully updated test created_at timestamp."""
    return {"success": True}


@server_router.post("/enter_error", response_model=dict[str, bool])
async def benchmark_enter_error_api(
    request: BenchmarkEnterErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while updating test created_at timestamp."""
    return {"success": True}

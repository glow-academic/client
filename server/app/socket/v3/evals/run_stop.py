"""Handler for eval_run_stop WebSocket event - stop a single eval run."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_pool, sio
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.websocket.cancel_active_run import cancel_active_run

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class EvalRunStopErrorPayload(BaseModel):
    """Response indicating an error occurred while stopping eval run."""

    success: bool
    message: str
    run_id: str


class EvalRunStoppedPayload(BaseModel):
    """Response indicating eval run was stopped successfully."""

    success: bool
    message: str
    attempt_id: str
    run_id: str


# Pydantic model for client-to-server event
class EvalRunStopPayload(BaseModel):
    """Request to stop a single eval run."""

    attempt_id: str
    run_id: str


# Emit helper functions
async def eval_run_stop_error(payload: EvalRunStopErrorPayload, room: str) -> None:
    await sio.emit("evals_run_stop_error", payload.model_dump(), room=room)


async def eval_run_stopped(payload: EvalRunStoppedPayload, room: str) -> None:
    await sio.emit("evals_run_stopped", payload.model_dump(), room=room)


async def _eval_run_stop_impl(sid: str, data: EvalRunStopPayload) -> None:
    """
    Handle eval run stop requests via WebSocket
    Stops a single active eval run
    """
    try:
        logger.info(f"Received eval_run_stop request from {sid} with data: {data}")

        attempt_id = data.attempt_id
        run_id = data.run_id

        if not attempt_id or not run_id:
            logger.error(f"Missing attempt_id or run_id in request from {sid}")
            await eval_run_stop_error(
                EvalRunStopErrorPayload(
                    success=False,
                    message="Missing attempt_id or run_id",
                    run_id=run_id or "unknown",
                ),
                room=sid,
            )
            return

        logger.info(
            f"Processing eval run stop: attempt_id={attempt_id}, run_id={run_id}, sid={sid}"
        )

        # Get connection pool
        pool = get_pool()
        if not pool:
            await eval_run_stop_error(
                EvalRunStopErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                    run_id=run_id,
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Find active test for this run_id
            # Test trace_id format: "eval_{attempt_id}_{run_id}"
            test_row = await conn.fetchrow(
                """
                SELECT t.id::text as test_id, t.completed
                FROM tests t
                JOIN attempt_tests at ON at.test_id = t.id
                WHERE at.attempt_id = $1::uuid
                  AND t.trace_id = $2
                  AND t.completed = false
                LIMIT 1
                """,
                attempt_id,
                f"eval_{attempt_id}_{run_id}",
            )

            if not test_row:
                logger.warning(
                    f"No active test found for run {run_id} in attempt {attempt_id}"
                )
                await eval_run_stopped(
                    EvalRunStoppedPayload(
                        attempt_id=attempt_id,
                        success=False,
                        message=f"No active run found for run {run_id[:8]}",
                        run_id=run_id,
                    ),
                    room=f"eval_{attempt_id}",
                )
                return

            test_id = test_row["test_id"]

            # Cancel active run using cancel_active_run utility
            # Note: cancel_active_run expects chat_id, but we can use test_id as identifier
            cancelled = await cancel_active_run(str(test_id))

            if cancelled:
                logger.info(
                    f"Successfully cancelled active run {run_id} for eval attempt {attempt_id}"
                )

                # Mark test as completed
                await conn.execute(
                    """
                    UPDATE tests SET completed = true, updated_at = NOW()
                    WHERE id = $1::uuid
                    """,
                    test_id,
                )

                # Mark eval_runs as completed (stopped)
                await conn.execute(
                    """
                    UPDATE eval_runs SET completed = true, updated_at = NOW()
                    WHERE eval_id = (
                        SELECT eval_id FROM eval_attempts WHERE id = $1::uuid
                    ) AND run_id = $2::uuid
                    """,
                    attempt_id,
                    run_id,
                )

                # Invalidate cache after stopping run
                try:
                    invalidation_tags = ["evals", "attempts"]
                    await invalidate_tags(invalidation_tags)
                    logger.info(
                        f"Invalidated cache for tags: {invalidation_tags} after stopping eval run {run_id}"
                    )
                except Exception as cache_error:
                    logger.warning(
                        f"Failed to invalidate cache after eval run stop: {cache_error}",
                        exc_info=True,
                    )

                # Emit stop signal
                await eval_run_stopped(
                    EvalRunStoppedPayload(
                        attempt_id=attempt_id,
                        success=True,
                        message=f"Stopped evaluation for run {run_id[:8]}",
                        run_id=run_id,
                    ),
                    room=f"eval_{attempt_id}",
                )
            else:
                logger.warning(
                    f"Failed to cancel active run {run_id} for eval attempt {attempt_id}"
                )
                await eval_run_stopped(
                    EvalRunStoppedPayload(
                        attempt_id=attempt_id,
                        success=False,
                        message=f"Failed to cancel active run {run_id[:8]}",
                        run_id=run_id,
                    ),
                    room=f"eval_{attempt_id}",
                )

    except Exception as e:
        logger.error(f"Error stopping eval run for {sid}: {str(e)}", exc_info=True)
        await eval_run_stop_error(
            EvalRunStopErrorPayload(
                success=False,
                message=f"Failed to stop eval run: {str(e)}",
                run_id=data.run_id,
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def eval_run_stop(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = EvalRunStopPayload(**data)
        await _eval_run_stop_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in eval_run_stop for {sid}: {e}")
        await eval_run_stop_error(
            EvalRunStopErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                run_id=data.get("run_id", "unknown"),
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/run_stop", response_model=dict[str, bool])
async def eval_run_stop_api(request: EvalRunStopPayload) -> dict[str, bool]:
    """Client-to-server event: Stop a single eval run."""
    return {"success": True}


@server_router.post("/run_stopped", response_model=dict[str, bool])
async def eval_run_stopped_api(request: EvalRunStoppedPayload) -> dict[str, bool]:
    """Server-to-client event: Eval run stopped successfully."""
    return {"success": True}


@server_router.post("/run_stop_error", response_model=dict[str, bool])
async def eval_run_stop_error_api(
    request: EvalRunStopErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while stopping eval run."""
    return {"success": True}


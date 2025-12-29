"""Handler for eval_stop WebSocket event."""

from typing import Any

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.websocket.cancel_active_run import cancel_active_run
from app.main import get_pool, sio
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class EvalStopErrorPayload(BaseModel):
    """Response indicating an error occurred while stopping eval."""

    success: bool
    message: str


class EvalStoppedPayload(BaseModel):
    """Response indicating eval was stopped successfully."""

    attempt_id: str
    success: bool
    message: str


# Pydantic model for client-to-server event
class EvalStopPayload(BaseModel):
    """Request to stop an active eval attempt."""

    attempt_id: str


# Emit helper functions
async def eval_stop_error(payload: EvalStopErrorPayload, room: str) -> None:
    await sio.emit("evals_stop_error", payload.model_dump(), room=room)


async def eval_stopped(payload: EvalStoppedPayload, room: str) -> None:
    await sio.emit("evals_stopped", payload.model_dump(), room=room)


async def _eval_stop_impl(sid: str, data: EvalStopPayload) -> None:
    """
    Handle eval stop requests via WebSocket
    Stops active run in eval attempt
    """
    try:
        attempt_id = data.attempt_id

        if not attempt_id:
            await eval_stop_error(
                EvalStopErrorPayload(success=False, message="Missing attempt_id"),
                room=sid,
            )
            logger.error(f"Emitted error to {sid}: Missing attempt_id")
            return

        # Get connection pool
        pool = get_pool()
        if not pool:
            await eval_stop_error(
                EvalStopErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            logger.error(
                f"Emitted error to {sid}: Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            # Find active run for the attempt (via attempt_tests → test_runs)
            sql_get_active_run = load_sql(
                "app/sql/v3/evals/get_active_run_for_attempt.sql"
            )
            active_run_row = await conn.fetchrow(sql_get_active_run, attempt_id)

            if not active_run_row:
                logger.warning(f"No active run found for eval attempt {attempt_id}")
                await eval_stopped(
                    EvalStoppedPayload(
                        attempt_id=attempt_id,
                        success=False,
                        message="No active run found for this eval attempt",
                    ),
                    room=f"eval_{attempt_id}",
                )
                return

            run_id = active_run_row["run_id"]
            test_id = active_run_row["test_id"]

            # Cancel active run using cancel_active_run utility
            # Note: cancel_active_run expects chat_id, but we can use test_id as identifier
            cancelled = await cancel_active_run(str(test_id))

            if cancelled:
                logger.info(
                    f"Successfully cancelled active run {run_id} for eval attempt {attempt_id}"
                )

                # Mark test as completed
                sql_complete_test = load_sql("app/sql/v3/evals/complete_test.sql")
                await conn.execute(sql_complete_test, test_id)

                # Emit stop signal
                await eval_stopped(
                    EvalStoppedPayload(
                        attempt_id=attempt_id,
                        success=True,
                        message="Eval stopped successfully",
                    ),
                    room=f"eval_{attempt_id}",
                )
                # Log activity
                try:
                    await log_websocket_activity(
                        sid=sid,
                        event_key="evals.stopped",
                        template="{{ actor.name }} stopped eval",
                        context={"attempt_id": attempt_id},
                        endpoint="/socket/v3/evals/stop",
                        error=False,
                    )
                except Exception as log_error:
                    logger.warning(f"Error logging eval stop activity: {log_error}")
            else:
                logger.warning(
                    f"Failed to cancel active run {run_id} for eval attempt {attempt_id}"
                )
                await eval_stopped(
                    EvalStoppedPayload(
                        attempt_id=attempt_id,
                        success=False,
                        message="Failed to cancel active run",
                    ),
                    room=f"eval_{attempt_id}",
                )

    except Exception as e:
        logger.error(f"Error stopping eval for {sid}: {str(e)}", exc_info=True)
        await eval_stop_error(
            EvalStopErrorPayload(
                success=False, message=f"Failed to stop eval: {str(e)}"
            ),
            room=sid,
        )
        logger.error(f"Emitted error to {sid}: Failed to stop eval: {str(e)}")
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="evals.stopped",
                template="{{ actor.name }} failed to stop eval",
                context={"error": str(e)},
                endpoint="/socket/v3/evals/stop",
                error=True,
            )
        except Exception as log_error:
            logger.warning(f"Error logging eval stop error activity: {log_error}")


@sio.event  # type: ignore
async def eval_stop(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = EvalStopPayload(**data)
        await _eval_stop_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in eval_stop for {sid}: {e}")
        await eval_stop_error(
            EvalStopErrorPayload(success=False, message=f"Invalid payload: {str(e)}"),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="evals.stopped",
                template="{{ actor.name }} failed to stop eval (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/evals/stop",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging eval stop validation error activity: {log_error}"
            )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/stop", response_model=dict[str, bool])
async def eval_stop_api(request: EvalStopPayload) -> dict[str, bool]:
    """Client-to-server event: Stop an active eval attempt."""
    return {"success": True}


@server_router.post("/stopped", response_model=dict[str, bool])
async def eval_stopped_api(request: EvalStoppedPayload) -> dict[str, bool]:
    """Server-to-client event: Eval stopped successfully."""
    return {"success": True}


@server_router.post("/stop_error", response_model=dict[str, bool])
async def eval_stop_error_api(request: EvalStopErrorPayload) -> dict[str, bool]:
    """Server-to-client event: Error occurred while stopping eval."""
    return {"success": True}

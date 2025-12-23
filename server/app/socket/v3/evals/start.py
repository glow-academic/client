"""Handler for eval_start WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_pool, sio
from app.infra.activity.websocket_logger import log_websocket_activity
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class EvalStartErrorPayload(BaseModel):
    """Response indicating an error occurred while starting eval."""

    success: bool
    message: str


class EvalStartedPayload(BaseModel):
    """Response indicating eval started successfully."""

    success: bool
    message: str
    attempt_id: str


# Pydantic model for client-to-server event
class EvalStartPayload(BaseModel):
    """Request to start an eval attempt."""

    eval_id: str
    profile_id: str | None = None
    conversation_mode: bool = False
    conversation_agent_id: str | None = None
    conversation_max_turns: int | None = None


# Emit helper functions
async def eval_start_error(payload: EvalStartErrorPayload, room: str) -> None:
    await sio.emit("evals_start_error", payload.model_dump(), room=room)


async def eval_started(payload: EvalStartedPayload, room: str) -> None:
    await sio.emit("evals_started", payload.model_dump(), room=room)


async def _eval_start_impl(sid: str, data: EvalStartPayload) -> None:
    """
    Handle eval start requests via WebSocket
    Creates eval_attempt only (no runs processed - user must start runs manually)
    """
    try:
        logger.info(f"Received eval_start request from {sid} with data: {data}")

        eval_id = data.eval_id
        profile_id = data.profile_id

        if not eval_id:
            logger.error(f"Missing eval_id in request from {sid}")
            await eval_start_error(
                EvalStartErrorPayload(success=False, message="Missing eval_id"),
                room=sid,
            )
            return

        # Normalize profile_id
        if profile_id == "" or profile_id == "null" or profile_id is None:
            profile_id = None

        logger.info(
            f"Processing eval start: eval_id={eval_id}, profile_id={profile_id}, sid={sid}"
        )

        # Get connection pool
        pool = get_pool()
        if not pool:
            await eval_start_error(
                EvalStartErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Create eval_attempt and get eval data + pending runs
            sql = load_sql("sql/v3/evals/start_eval_attempt_complete.sql")
            row = await conn.fetchrow(
                sql,
                eval_id,
                data.conversation_mode,
                data.conversation_agent_id if data.conversation_agent_id else None,
                data.conversation_max_turns,
            )

            if not row:
                await eval_start_error(
                    EvalStartErrorPayload(
                        success=False, message="Failed to start eval attempt"
                    ),
                    room=sid,
                )
                return

            attempt_id = row["attempt_id"]
            pending_run_ids = row.get("pending_run_ids") or []

            if not pending_run_ids or len(pending_run_ids) == 0:
                await eval_start_error(
                    EvalStartErrorPayload(
                        success=False, message="No pending runs to evaluate"
                    ),
                    room=sid,
                )
                return

            # Invalidate cache after creating attempt
            try:
                invalidation_tags = ["evals", "attempts"]
                await invalidate_tags(invalidation_tags)
                logger.info(
                    f"Invalidated cache for tags: {invalidation_tags} after creating eval attempt {attempt_id}"
                )
            except Exception as cache_error:
                logger.warning(
                    f"Failed to invalidate cache after eval start: {cache_error}",
                    exc_info=True,
                )

            # Join the client to the eval room for real-time updates
            eval_room = f"eval_{attempt_id}"
            await sio.enter_room(sid, eval_room)
            logger.info(f"Client {sid} joined eval room {eval_room}")

            # Emit success response (no runs processed - user must start manually)
            await eval_started(
                EvalStartedPayload(
                    success=True,
                    message=f"Eval attempt created with {len(pending_run_ids)} pending runs. Use the attempt page to start runs.",
                    attempt_id=attempt_id,
                ),
                room=sid,
            )

            logger.info(
                f"Eval attempt created successfully for {sid}: attempt={attempt_id}, pending_runs={len(pending_run_ids)}"
            )
            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="evals.started",
                    template="{{ actor.name }} started eval",
                    context={"eval_id": eval_id, "attempt_id": attempt_id},
                    endpoint="/socket/v3/evals/start",
                    error=False,
                )
            except Exception as log_error:
                logger.warning(f"Error logging eval start activity: {log_error}")

    except Exception as e:
        logger.error(f"Error starting eval for {sid}: {str(e)}", exc_info=True)
        await eval_start_error(
            EvalStartErrorPayload(
                success=False, message=f"Failed to start eval: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="evals.started",
                template="{{ actor.name }} failed to start eval",
                context={"error": str(e)},
                endpoint="/socket/v3/evals/start",
                error=True,
            )
        except Exception as log_error:
            logger.warning(f"Error logging eval start error activity: {log_error}")


@sio.event  # type: ignore
async def eval_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = EvalStartPayload(**data)
        await _eval_start_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in eval_start for {sid}: {e}")
        await eval_start_error(
            EvalStartErrorPayload(success=False, message=f"Invalid payload: {str(e)}"),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="evals.started",
                template="{{ actor.name }} failed to start eval (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/evals/start",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging eval start validation error activity: {log_error}"
            )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/start", response_model=dict[str, bool])
async def eval_start_api(request: EvalStartPayload) -> dict[str, bool]:
    """Client-to-server event: Start an eval attempt."""
    return {"success": True}


@server_router.post("/started", response_model=dict[str, bool])
async def eval_started_api(request: EvalStartedPayload) -> dict[str, bool]:
    """Server-to-client event: Eval started successfully."""
    return {"success": True}


@server_router.post("/start_error", response_model=dict[str, bool])
async def eval_start_error_api(request: EvalStartErrorPayload) -> dict[str, bool]:
    """Server-to-client event: Error occurred while starting eval."""
    return {"success": True}

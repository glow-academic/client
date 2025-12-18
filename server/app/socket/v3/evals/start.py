"""Handler for eval_start WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_pool, sio
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.evals.run_eval_single_run import run_eval_single_run
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


# Emit helper functions
async def eval_start_error(payload: EvalStartErrorPayload, room: str) -> None:
    await sio.emit("evals_start_error", payload.model_dump(), room=room)


async def eval_started(payload: EvalStartedPayload, room: str) -> None:
    await sio.emit("evals_started", payload.model_dump(), room=room)


async def _eval_start_impl(sid: str, data: EvalStartPayload) -> None:
    """
    Handle eval start requests via WebSocket
    Creates eval_attempt and begins processing first run
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
            row = await conn.fetchrow(sql, eval_id)

            if not row:
                await eval_start_error(
                    EvalStartErrorPayload(
                        success=False, message="Failed to start eval attempt"
                    ),
                    room=sid,
                )
                return

            attempt_id = row["attempt_id"]
            agent_id = row["agent_id"]
            eval_agent_id = row["eval_agent_id"]
            rubric_id = row["rubric_id"]
            dynamic = row.get("dynamic", False)
            pending_run_ids = row.get("pending_run_ids") or []

            if not pending_run_ids or len(pending_run_ids) == 0:
                await eval_start_error(
                    EvalStartErrorPayload(
                        success=False, message="No pending runs to evaluate"
                    ),
                    room=sid,
                )
                return

            # Get first pending run
            first_run_id = pending_run_ids[0]

            # Get department_id from first run if not available
            department_id = None
            dept_row = await conn.fetchrow(
                """
                SELECT d.id::text as department_id
                FROM runs r
                JOIN run_profiles rp ON rp.run_id = r.id AND rp.active = true
                JOIN profile_departments pd ON pd.profile_id = rp.profile_id AND pd.active = true
                JOIN departments d ON d.id = pd.department_id AND d.active = true
                WHERE r.id = $1::uuid
                LIMIT 1
                """,
                first_run_id,
            )
            if dept_row:
                department_id = dept_row["department_id"]

            # Define emit function for progress updates
            async def emit_progress(event_data: dict[str, Any]) -> None:
                await sio.emit(
                    "evals_status_update", event_data, room=f"eval_{attempt_id}"
                )

            # Process first run
            logger.info(
                f"Processing first run {first_run_id} for eval attempt {attempt_id}"
            )
            result = await run_eval_single_run(
                conn=conn,
                eval_id=eval_id,
                attempt_id=attempt_id,
                test_id=None,  # Will be created
                run_id=first_run_id,
                eval_agent_id=eval_agent_id,
                rubric_id=rubric_id,
                department_id=department_id,
                profile_id=profile_id,
                dynamic=dynamic,
                agent_id=agent_id,
                emit_progress_func=emit_progress,
            )

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

            # Emit success response
            await eval_started(
                EvalStartedPayload(
                    success=True,
                    message="Eval started successfully",
                    attempt_id=attempt_id,
                ),
                room=sid,
            )

            logger.info(
                f"Eval started successfully for {sid}: attempt={attempt_id}, processed first run {first_run_id}"
            )

            # Process next run in background (recursive)
            if len(pending_run_ids) > 1:
                import asyncio
                from app.socket.v3.evals.process_next import _eval_process_next_impl
                from app.socket.v3.evals.process_next import EvalProcessNextPayload

                # Create background task to process next run
                process_next_payload = EvalProcessNextPayload(
                    attempt_id=attempt_id,
                    eval_id=eval_id,
                    current_run_id=first_run_id,
                    eval_agent_id=eval_agent_id,
                    rubric_id=rubric_id,
                    department_id=department_id,
                    profile_id=profile_id,
                )
                # Use a dummy sid for background processing
                asyncio.create_task(
                    _eval_process_next_impl("background", process_next_payload)
                )

    except Exception as e:
        logger.error(f"Error starting eval for {sid}: {str(e)}", exc_info=True)
        await eval_start_error(
            EvalStartErrorPayload(
                success=False, message=f"Failed to start eval: {str(e)}"
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def eval_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = EvalStartPayload(**data)
        await _eval_start_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in eval_start for {sid}: {e}")
        await eval_start_error(
            EvalStartErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
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


"""Handler for eval_runs_start_all WebSocket event - start all pending runs in parallel."""

import asyncio
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.main import get_pool, sio

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class EvalRunsStartAllErrorPayload(BaseModel):
    """Response indicating an error occurred while starting all runs."""

    success: bool
    message: str
    attempt_id: str


class EvalRunsStartAllStartedPayload(BaseModel):
    """Response indicating all runs started successfully."""

    success: bool
    message: str
    attempt_id: str
    started_count: int


# Pydantic model for client-to-server event
class EvalRunsStartAllPayload(BaseModel):
    """Request to start all pending eval runs."""

    attempt_id: str
    profile_id: str | None = None


# Emit helper functions
async def eval_runs_start_all_error(
    payload: EvalRunsStartAllErrorPayload, room: str
) -> None:
    await sio.emit("evals_runs_start_all_error", payload.model_dump(), room=room)


async def eval_runs_start_all_started(
    payload: EvalRunsStartAllStartedPayload, room: str
) -> None:
    await sio.emit("evals_runs_start_all_started", payload.model_dump(), room=room)


async def _eval_runs_start_all_impl(sid: str, data: EvalRunsStartAllPayload) -> None:
    """
    Handle eval runs start all requests via WebSocket
    Starts all pending runs in parallel (not sequential)
    """
    try:
        logger.info(
            f"Received eval_runs_start_all request from {sid} with data: {data}"
        )

        attempt_id = data.attempt_id
        profile_id = data.profile_id

        if not attempt_id:
            logger.error(f"Missing attempt_id in request from {sid}")
            await eval_runs_start_all_error(
                EvalRunsStartAllErrorPayload(
                    success=False,
                    message="Missing attempt_id",
                    attempt_id=attempt_id or "unknown",
                ),
                room=sid,
            )
            return

        # Normalize profile_id
        if profile_id == "" or profile_id == "null" or profile_id is None:
            profile_id = None

        logger.info(
            f"Processing eval runs start all: attempt_id={attempt_id}, profile_id={profile_id}, sid={sid}"
        )

        # Get connection pool
        pool = get_pool()
        if not pool:
            await eval_runs_start_all_error(
                EvalRunsStartAllErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                    attempt_id=attempt_id,
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Get pending runs for this attempt
            sql_get_pending = load_sql(
                "app/sql/v3/evals/get_pending_runs_for_attempt.sql"
            )
            result = await conn.fetchrow(sql_get_pending, attempt_id)

            if not result:
                await eval_runs_start_all_error(
                    EvalRunsStartAllErrorPayload(
                        success=False,
                        message="Failed to get pending runs",
                        attempt_id=attempt_id,
                    ),
                    room=sid,
                )
                return

            pending_run_ids = result.get("pending_run_ids") or []

            if not pending_run_ids or len(pending_run_ids) == 0:
                await eval_runs_start_all_started(
                    EvalRunsStartAllStartedPayload(
                        success=True,
                        message="No pending runs to start",
                        attempt_id=attempt_id,
                        started_count=0,
                    ),
                    room=f"eval_{attempt_id}",
                )
                return

            # Import here to avoid circular dependency
            from app.socket.v3.agents.eval.run_start import (
                EvalRunStartPayload,
                _eval_run_start_impl,
            )

            # Start all runs in parallel (server-to-server events)
            tasks = []
            for run_id in pending_run_ids:
                run_start_payload = EvalRunStartPayload(
                    attempt_id=attempt_id,
                    run_id=run_id,
                    profile_id=profile_id,
                )
                # Use background sid for server-to-server processing
                task = asyncio.create_task(
                    _eval_run_start_impl("background", run_start_payload)
                )
                tasks.append(task)

            # Don't await tasks - let them run in background
            # Just log that we've started them
            logger.info(
                f"Started {len(tasks)} eval runs in parallel for attempt {attempt_id}"
            )

            # Emit success response immediately (runs are processing in background)
            await eval_runs_start_all_started(
                EvalRunsStartAllStartedPayload(
                    success=True,
                    message=f"Started {len(pending_run_ids)} eval runs in parallel",
                    attempt_id=attempt_id,
                    started_count=len(pending_run_ids),
                ),
                room=f"eval_{attempt_id}",
            )

    except Exception as e:
        logger.error(f"Error starting all eval runs for {sid}: {str(e)}", exc_info=True)
        await eval_runs_start_all_error(
            EvalRunsStartAllErrorPayload(
                success=False,
                message=f"Failed to start all eval runs: {str(e)}",
                attempt_id=data.attempt_id,
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def eval_runs_start_all(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = EvalRunsStartAllPayload(**data)
        await _eval_runs_start_all_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in eval_runs_start_all for {sid}: {e}")
        await eval_runs_start_all_error(
            EvalRunsStartAllErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                attempt_id=data.get("attempt_id", "unknown"),
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/runs_start_all", response_model=dict[str, bool])
async def eval_runs_start_all_api(
    request: EvalRunsStartAllPayload,
) -> dict[str, bool]:
    """Client-to-server event: Start all pending eval runs."""
    return {"success": True}


@server_router.post("/runs_start_all_started", response_model=dict[str, bool])
async def eval_runs_start_all_started_api(
    request: EvalRunsStartAllStartedPayload,
) -> dict[str, bool]:
    """Server-to-client event: All eval runs started successfully."""
    return {"success": True}


@server_router.post("/runs_start_all_error", response_model=dict[str, bool])
async def eval_runs_start_all_error_api(
    request: EvalRunsStartAllErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while starting all eval runs."""
    return {"success": True}

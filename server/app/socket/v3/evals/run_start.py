"""Handler for eval_run_start WebSocket event - start a single eval run."""

from typing import Any

from app.infra.v3.evals.run_eval_single_run import run_eval_single_run
from app.main import get_pool, sio
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.cache.invalidate_tags import invalidate_tags
from utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class EvalRunStartErrorPayload(BaseModel):
    """Response indicating an error occurred while starting eval run."""

    success: bool
    message: str
    run_id: str


class EvalRunStartedPayload(BaseModel):
    """Response indicating eval run started successfully."""

    success: bool
    message: str
    attempt_id: str
    run_id: str


# Pydantic model for client-to-server event
class EvalRunStartPayload(BaseModel):
    """Request to start a single eval run."""

    attempt_id: str
    run_id: str
    profile_id: str | None = None


# Emit helper functions
async def eval_run_start_error(payload: EvalRunStartErrorPayload, room: str) -> None:
    await sio.emit("evals_run_start_error", payload.model_dump(), room=room)


async def eval_run_started(payload: EvalRunStartedPayload, room: str) -> None:
    await sio.emit("evals_run_started", payload.model_dump(), room=room)


async def _eval_run_start_impl(sid: str, data: EvalRunStartPayload) -> None:
    """
    Handle eval run start requests via WebSocket
    Starts a single eval run (idempotent - checks if already completed/in_progress)
    """
    try:
        logger.info(f"Received eval_run_start request from {sid} with data: {data}")

        attempt_id = data.attempt_id
        run_id = data.run_id
        profile_id = data.profile_id

        if not attempt_id or not run_id:
            logger.error(f"Missing attempt_id or run_id in request from {sid}")
            await eval_run_start_error(
                EvalRunStartErrorPayload(
                    success=False,
                    message="Missing attempt_id or run_id",
                    run_id=run_id or "unknown",
                ),
                room=sid,
            )
            return

        # Normalize profile_id
        if profile_id == "" or profile_id == "null" or profile_id is None:
            profile_id = None

        logger.info(
            f"Processing eval run start: attempt_id={attempt_id}, run_id={run_id}, profile_id={profile_id}, sid={sid}"
        )

        # Get connection pool
        pool = get_pool()
        if not pool:
            await eval_run_start_error(
                EvalRunStartErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                    run_id=run_id,
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Get eval data from attempt
            sql_get_eval_id = load_sql("app/sql/v3/evals/get_eval_id_for_attempt.sql")
            attempt_row = await conn.fetchrow(sql_get_eval_id, attempt_id)
            if not attempt_row:
                await eval_run_start_error(
                    EvalRunStartErrorPayload(
                        success=False,
                        message=f"Eval attempt not found: {attempt_id}",
                        run_id=run_id,
                    ),
                    room=sid,
                )
                return

            eval_id = attempt_row["eval_id"]

            # Check if run is already completed (idempotency check)
            sql_check_completed = load_sql(
                "app/sql/v3/evals/get_eval_run_completed.sql"
            )
            completed_check = await conn.fetchrow(
                sql_check_completed,
                eval_id,
                run_id,
            )
            if completed_check and completed_check["completed"]:
                logger.info(
                    f"Run {run_id} already completed for eval {eval_id}, skipping"
                )
                await eval_run_started(
                    EvalRunStartedPayload(
                        success=True,
                        message=f"Run {run_id[:8]} already completed",
                        attempt_id=attempt_id,
                        run_id=run_id,
                    ),
                    room=f"eval_{attempt_id}",
                )
                return

            # Check if test exists and is in progress (idempotency check)
            test_check = await conn.fetchrow(
                """
                SELECT t.id::text as test_id, t.completed
                FROM tests t
                JOIN attempt_tests at ON at.test_id = t.id
                WHERE at.attempt_id = $1::uuid
                  AND t.trace_id LIKE $2
                  AND t.completed = false
                LIMIT 1
                """,
                attempt_id,
                f"eval_{attempt_id}_{run_id}",
            )
            if test_check:
                logger.info(
                    f"Run {run_id} already in progress (test {test_check['test_id']}), skipping"
                )
                await eval_run_started(
                    EvalRunStartedPayload(
                        success=True,
                        message=f"Run {run_id[:8]} already in progress",
                        attempt_id=attempt_id,
                        run_id=run_id,
                    ),
                    room=f"eval_{attempt_id}",
                )
                return

            # Get eval data (agent_id, eval_agent_id, rubric_id, dynamic)
            eval_row = await conn.fetchrow(
                """
                SELECT 
                    e.agent_id::text as agent_id,
                    e.eval_agent_id::text as eval_agent_id,
                    e.rubric_id::text as rubric_id,
                    e.dynamic
                FROM evals e
                WHERE e.id = $1::uuid
                """,
                eval_id,
            )
            if not eval_row:
                await eval_run_start_error(
                    EvalRunStartErrorPayload(
                        success=False,
                        message=f"Eval not found: {eval_id}",
                        run_id=run_id,
                    ),
                    room=sid,
                )
                return

            agent_id = eval_row["agent_id"]
            eval_agent_id = eval_row["eval_agent_id"]
            rubric_id = eval_row["rubric_id"]
            dynamic = eval_row.get("dynamic", False)

            # Get department_id from run
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
                run_id,
            )
            if dept_row:
                department_id = dept_row["department_id"]

            # Define emit function for progress updates
            async def emit_progress(event_data: dict[str, Any]) -> None:
                await sio.emit(
                    "evals_status_update", event_data, room=f"eval_{attempt_id}"
                )

            # Process run
            logger.info(f"Processing run {run_id} for eval attempt {attempt_id}")
            result = await run_eval_single_run(
                conn=conn,
                eval_id=eval_id,
                attempt_id=attempt_id,
                test_id=None,  # Will be created
                run_id=run_id,
                eval_agent_id=eval_agent_id,
                rubric_id=rubric_id,
                department_id=department_id,
                profile_id=profile_id,
                dynamic=dynamic,
                agent_id=agent_id,
                emit_progress_func=emit_progress,
            )

            # Invalidate cache after processing run
            try:
                invalidation_tags = ["evals", "attempts"]
                await invalidate_tags(invalidation_tags)
                logger.info(
                    f"Invalidated cache for tags: {invalidation_tags} after starting eval run {run_id}"
                )
            except Exception as cache_error:
                logger.warning(
                    f"Failed to invalidate cache after eval run start: {cache_error}",
                    exc_info=True,
                )

            # Emit success response
            await eval_run_started(
                EvalRunStartedPayload(
                    success=True,
                    message=f"Started evaluation for run {run_id[:8]}",
                    attempt_id=attempt_id,
                    run_id=run_id,
                ),
                room=f"eval_{attempt_id}",
            )

            logger.info(
                f"Eval run started successfully for {sid}: attempt={attempt_id}, run={run_id}"
            )

    except Exception as e:
        logger.error(f"Error starting eval run for {sid}: {str(e)}", exc_info=True)
        await eval_run_start_error(
            EvalRunStartErrorPayload(
                success=False,
                message=f"Failed to start eval run: {str(e)}",
                run_id=data.run_id,
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def eval_run_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = EvalRunStartPayload(**data)
        await _eval_run_start_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in eval_run_start for {sid}: {e}")
        await eval_run_start_error(
            EvalRunStartErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                run_id=data.get("run_id", "unknown"),
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/run_start", response_model=dict[str, bool])
async def eval_run_start_api(request: EvalRunStartPayload) -> dict[str, bool]:
    """Client-to-server event: Start a single eval run."""
    return {"success": True}


@server_router.post("/run_started", response_model=dict[str, bool])
async def eval_run_started_api(request: EvalRunStartedPayload) -> dict[str, bool]:
    """Server-to-client event: Eval run started successfully."""
    return {"success": True}


@server_router.post("/run_start_error", response_model=dict[str, bool])
async def eval_run_start_error_api(
    request: EvalRunStartErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while starting eval run."""
    return {"success": True}

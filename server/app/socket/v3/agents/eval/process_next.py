"""Handler for eval_process_next WebSocket event (recursive processing)."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.evals.run_eval_single_run import run_eval_single_run
from app.main import get_pool, sio

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class EvalRunCompletedPayload(BaseModel):
    """Response indicating a single run evaluation completed."""

    eval_id: str
    run_id: str
    test_id: str
    status: str
    message: str
    grade_id: str | None = None


class EvalCompletedPayload(BaseModel):
    """Response indicating all runs in eval are completed."""

    eval_id: str
    attempt_id: str
    message: str


class EvalProcessNextErrorPayload(BaseModel):
    """Response indicating an error occurred while processing next run."""

    success: bool
    message: str
    eval_id: str
    run_id: str | None = None


# Pydantic model for server-to-server event (can be triggered recursively)
class EvalProcessNextPayload(BaseModel):
    """Request to process next pending run in eval attempt."""

    attempt_id: str
    eval_id: str
    current_run_id: str
    eval_agent_id: str
    rubric_id: str
    department_id: str | None = None
    profile_id: str | None = None


# Emit helper functions
async def eval_run_completed(payload: EvalRunCompletedPayload, room: str) -> None:
    await sio.emit("evals_run_completed", payload.model_dump(), room=room)


async def eval_completed(payload: EvalCompletedPayload, room: str) -> None:
    await sio.emit("evals_completed", payload.model_dump(), room=room)


async def eval_process_next_error(
    payload: EvalProcessNextErrorPayload, room: str
) -> None:
    await sio.emit("evals_process_next_error", payload.model_dump(), room=room)


async def _eval_process_next_impl(sid: str, data: EvalProcessNextPayload) -> None:
    """
    Handle eval_process_next requests via WebSocket
    Processes next pending run in the eval attempt (recursive)
    """
    try:
        logger.info(f"Received eval_process_next request from {sid} with data: {data}")

        attempt_id = data.attempt_id
        eval_id = data.eval_id
        current_run_id = data.current_run_id
        eval_agent_id = data.eval_agent_id
        rubric_id = data.rubric_id
        department_id = data.department_id
        profile_id = data.profile_id

        # Get connection pool
        pool = get_pool()
        if not pool:
            await eval_process_next_error(
                EvalProcessNextErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                    eval_id=eval_id,
                ),
                room=f"eval_{attempt_id}",
            )
            return

        async with pool.acquire() as conn:
            # Get eval data (dynamic flag and agent_id) and attempt infinite_mode
            sql_get_eval = load_sql("app/sql/v3/evals/get_eval_dynamic_and_agent.sql")
            eval_row = await conn.fetchrow(sql_get_eval, eval_id)
            if not eval_row:
                await eval_process_next_error(
                    EvalProcessNextErrorPayload(
                        success=False,
                        message=f"Eval not found: {eval_id}",
                        eval_id=eval_id,
                    ),
                    room=f"eval_{attempt_id}",
                )
                return

            # Get infinite_mode from attempt
            attempt_row = await conn.fetchrow(
                "SELECT infinite_mode FROM eval_attempts WHERE id = $1::uuid",
                attempt_id,
            )
            infinite_mode = attempt_row.get("infinite_mode", False) if attempt_row else False

            dynamic = eval_row.get("dynamic", False)
            agent_id = eval_row.get("agent_id")

            # Get all runs for this eval (for infinite mode cycling)
            sql_get_all_runs = load_sql("app/sql/v3/evals/run_eval.sql")
            all_runs_result = await conn.fetchrow(sql_get_all_runs, eval_id)
            all_run_ids = all_runs_result.get("pending_run_ids", []) if all_runs_result else []

            if not all_run_ids:
                # No runs at all - emit completion
                await eval_completed(
                    EvalCompletedPayload(
                        eval_id=eval_id,
                        attempt_id=attempt_id,
                        message="No runs to evaluate",
                    ),
                    room=f"eval_{attempt_id}",
                )
                logger.info(f"No runs found for eval {eval_id}")
                return

            # Get all completed runs for this eval
            sql_get_completed_runs = load_sql(
                "app/sql/v3/evals/get_completed_runs_for_eval.sql"
            )
            completed_runs = await conn.fetch(sql_get_completed_runs, eval_id)
            completed_run_ids = {row["run_id"] for row in completed_runs}

            # Find next unprocessed run (skip current_run_id)
            next_run_id = None
            for run_id in all_run_ids:
                if run_id not in completed_run_ids and run_id != current_run_id:
                    next_run_id = run_id
                    break

            if not next_run_id:
                # No more unprocessed runs
                if infinite_mode:
                    # In infinite mode, cycle back to beginning - use first run from all runs
                    # (even if it was already completed, we'll process it again)
                    if all_run_ids:
                        next_run_id = all_run_ids[0]
                        logger.info(f"Infinite mode: cycling to first run {next_run_id} for eval {eval_id}")
                    else:
                        # No runs at all - emit completion
                        await eval_completed(
                            EvalCompletedPayload(
                                eval_id=eval_id,
                                attempt_id=attempt_id,
                                message="No runs to evaluate",
                            ),
                            room=f"eval_{attempt_id}",
                        )
                        logger.info(f"No runs found for eval {eval_id}")
                        return
                else:
                    # Not infinite mode - emit completion event
                    await eval_completed(
                        EvalCompletedPayload(
                            eval_id=eval_id,
                            attempt_id=attempt_id,
                            message="All runs completed",
                        ),
                        room=f"eval_{attempt_id}",
                    )
                    logger.info(f"All runs completed for eval {eval_id}")
                    # Log activity (skip if background processing)
                    if sid != "background":
                        try:
                            await log_websocket_activity(
                                sid=sid,
                                event_key="evals.process_next",
                                template="{{ actor.name }} completed processing eval runs",
                                context={"eval_id": eval_id, "attempt_id": attempt_id},
                                endpoint="/socket/v3/evals/process_next",
                                error=False,
                            )
                        except Exception as log_error:
                            logger.warning(
                                f"Error logging eval process_next activity: {log_error}"
                            )
                    return

            # Get department_id from next run if not provided
            if not department_id:
                sql_get_department = load_sql(
                    "app/sql/v3/evals/get_department_for_run.sql"
                )
                dept_row = await conn.fetchrow(sql_get_department, next_run_id)
                if dept_row:
                    department_id = dept_row["department_id"]

            # Define emit function for progress updates
            async def emit_progress(event_data: dict[str, Any]) -> None:
                await sio.emit(
                    "evals_status_update", event_data, room=f"eval_{attempt_id}"
                )

            # Get rubric_grade_agent_id for this specific run from junction table
            rga_row = await conn.fetchrow(
                """
                SELECT 
                    errga.rubric_grade_agent_id::text as rubric_grade_agent_id
                FROM evals e
                LEFT JOIN eval_runs_rubric_grade_agents errga ON errga.eval_id = e.id AND errga.run_id = $2::uuid AND e.use_groups = false
                LEFT JOIN eval_groups_rubric_grade_agents egga ON egga.eval_id = e.id AND egga.group_id IN (
                    SELECT gr.group_id FROM group_runs gr WHERE gr.run_id = $2::uuid
                ) AND e.use_groups = true
                WHERE e.id = $1::uuid
                ORDER BY COALESCE(errga.created_at, egga.created_at)
                LIMIT 1
                """,
                eval_id,
                next_run_id,
            )
            if not rga_row or not rga_row.get("rubric_grade_agent_id"):
                await eval_process_next_error(
                    EvalProcessNextErrorPayload(
                        success=False,
                        message=f"No rubric_grade_agent found for run {next_run_id}",
                        eval_id=eval_id,
                    ),
                    room=f"eval_{attempt_id}",
                )
                return
            
            rubric_grade_agent_id = rga_row["rubric_grade_agent_id"]

            # Process next run
            logger.info(
                f"Processing next run {next_run_id} for eval attempt {attempt_id}"
            )
            result = await run_eval_single_run(
                conn=conn,
                eval_id=eval_id,
                attempt_id=attempt_id,
                test_id=None,  # Will be created
                run_id=next_run_id,
                rubric_grade_agent_id=rubric_grade_agent_id,
                department_id=department_id,
                profile_id=profile_id,
                dynamic=dynamic,
                agent_id=agent_id,
                emit_progress_func=emit_progress,
            )

            # Emit run completed event
            await eval_run_completed(
                EvalRunCompletedPayload(
                    eval_id=eval_id,
                    run_id=next_run_id,
                    test_id=result["test_id"],
                    status="completed",
                    message=f"Completed evaluation for run {next_run_id[:8]}",
                    grade_id=result.get("grade_id"),
                ),
                room=f"eval_{attempt_id}",
            )

            logger.info(
                f"Completed run {next_run_id} for eval {eval_id}, checking for more runs..."
            )

            # Process next run in background (recursive)
            import asyncio

            process_next_payload = EvalProcessNextPayload(
                attempt_id=attempt_id,
                eval_id=eval_id,
                current_run_id=next_run_id,
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
        logger.error(
            f"Error processing next run for eval {data.eval_id}: {str(e)}",
            exc_info=True,
        )
        await eval_process_next_error(
            EvalProcessNextErrorPayload(
                success=False,
                message=f"Failed to process next run: {str(e)}",
                eval_id=data.eval_id,
                run_id=getattr(data, "current_run_id", None),
            ),
            room=f"eval_{data.attempt_id}",
        )
        # Log activity error (skip if background processing)
        if sid != "background":
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="evals.process_next",
                    template="{{ actor.name }} failed to process eval runs",
                    context={"error": str(e), "eval_id": data.eval_id},
                    endpoint="/socket/v3/evals/process_next",
                    error=True,
                )
            except Exception as log_error:
                logger.warning(
                    f"Error logging eval process_next error activity: {log_error}"
                )


@sio.event  # type: ignore
async def eval_process_next(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = EvalProcessNextPayload(**data)
        await _eval_process_next_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in eval_process_next for {sid}: {e}")
        await eval_process_next_error(
            EvalProcessNextErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                eval_id=data.get("eval_id", "unknown"),
            ),
            room=f"eval_{data.get('attempt_id', 'unknown')}",
        )


# FastAPI endpoint for OpenAPI documentation
@server_router.post("/process_next", response_model=dict[str, bool])
async def eval_process_next_api(request: EvalProcessNextPayload) -> dict[str, bool]:
    """Server-to-server event: Process next pending run in eval attempt."""
    return {"success": True}


@server_router.post("/run_completed", response_model=dict[str, bool])
async def eval_run_completed_api(request: EvalRunCompletedPayload) -> dict[str, bool]:
    """Server-to-client event: Single run evaluation completed."""
    return {"success": True}


@server_router.post("/completed", response_model=dict[str, bool])
async def eval_completed_api(request: EvalCompletedPayload) -> dict[str, bool]:
    """Server-to-client event: All runs in eval completed."""
    return {"success": True}


@server_router.post("/process_next_error", response_model=dict[str, bool])
async def eval_process_next_error_api(
    request: EvalProcessNextErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while processing next run."""
    return {"success": True}

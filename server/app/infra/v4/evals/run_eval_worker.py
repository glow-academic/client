"""Eval worker utility - evaluates model_runs against rubrics."""

import asyncio
import logging
import uuid
from typing import Any, cast

import asyncpg  # type: ignore

from app.main import get_pool
from app.sql.types import (
    InfrastructureEvalsGetRubricDetailsSqlParams,
    InfrastructureEvalsGetRubricDetailsSqlRow,
    InfrastructureEvalsMarkModelRunCompleteSqlParams,
    InfrastructureEvalsMarkModelRunIncompleteSqlParams,
)
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = logging.getLogger(__name__)

MARK_MODEL_RUN_INCOMPLETE_SQL_PATH = (
    "app/sql/v4/queries/infrastructure/evals/mark_model_run_incomplete_v4_complete.sql"
)
MARK_MODEL_RUN_COMPLETE_SQL_PATH = (
    "app/sql/v4/queries/infrastructure/evals/mark_model_run_complete_v4_complete.sql"
)
GET_RUBRIC_DETAILS_SQL_PATH = (
    "app/sql/v4/queries/infrastructure/evals/get_rubric_details_v4_complete.sql"
)

# Global semaphore to limit concurrent eval runs (max 4)
_eval_semaphore = asyncio.Semaphore(4)

# Global dict to track active eval tasks for cancellation
_active_eval_tasks: dict[str, asyncio.Task[None]] = {}


async def run_single_eval(
    eval_id: str,
    model_run_id: str,
    rubric_id: str,
    conn: asyncpg.Connection,
    emit_progress_func: Any | None = None,
) -> None:
    """Evaluate a single model_run against a rubric.

    Args:
        eval_id: The eval ID
        model_run_id: The model_run ID to evaluate
        rubric_id: The rubric ID to use for evaluation
        conn: Database connection
        emit_progress_func: Optional function to emit WebSocket progress events
    """
    try:
        # Mark as in progress
        params = InfrastructureEvalsMarkModelRunIncompleteSqlParams(
            eval_id=uuid.UUID(eval_id),
            model_run_id=uuid.UUID(model_run_id),
        )
        await execute_sql_typed(conn, MARK_MODEL_RUN_INCOMPLETE_SQL_PATH, params=params)

        # Emit progress event
        if emit_progress_func:
            await emit_progress_func(
                {
                    "eval_id": eval_id,
                    "model_run_id": model_run_id,
                    "status": "running",
                    "message": f"Evaluating model_run {model_run_id[:8]}...",
                }
            )

        # TODO: Implement actual grading logic here
        # For now, create a placeholder grade
        # In the future, this should:
        # 1. Get rubric and standards
        # 2. Get model_run content/output (if available)
        # 3. Use grading agent to evaluate
        # 4. Create eval_grades and eval_feedbacks records

        # Get rubric info
        rubric_params = InfrastructureEvalsGetRubricDetailsSqlParams(
            rubric_id=uuid.UUID(rubric_id)
        )
        rubric_result = cast(
            InfrastructureEvalsGetRubricDetailsSqlRow,
            await execute_sql_typed(
                conn, GET_RUBRIC_DETAILS_SQL_PATH, params=rubric_params
            ),
        )
        if not rubric_result:
            raise ValueError(f"Rubric not found: {rubric_id}")

        rubric = {
            "id": rubric_result.id,
            "name": rubric_result.name,
            "points": rubric_result.points,
            "pass_points": rubric_result.pass_points,
        }

        # Placeholder: Create a grade with default values
        # In production, this should use actual grading logic
        grade_sql = load_sql("app/sql/v4/queries/evals/create_eval_grade.sql")
        grade_result = await conn.fetchrow(
            grade_sql,
            model_run_id,
            eval_id,
            "Evaluation completed",  # description
            True,  # passed (placeholder)
            rubric["points"],  # score (placeholder - use full points)
            0,  # time_taken (placeholder)
        )

        if not grade_result:
            raise ValueError("Failed to create eval grade")

        # Mark as completed
        complete_params = InfrastructureEvalsMarkModelRunCompleteSqlParams(
            eval_id=uuid.UUID(eval_id),
            model_run_id=uuid.UUID(model_run_id),
        )
        await execute_sql_typed(
            conn, MARK_MODEL_RUN_COMPLETE_SQL_PATH, params=complete_params
        )

        # Emit completion event
        if emit_progress_func:
            await emit_progress_func(
                {
                    "eval_id": eval_id,
                    "model_run_id": model_run_id,
                    "status": "completed",
                    "message": f"Completed evaluation for model_run {model_run_id[:8]}",
                    "grade_id": grade_result["grade_id"],
                }
            )

        logger.info(f"Completed eval {eval_id} for model_run {model_run_id}")
    except Exception as e:
        logger.error(
            f"Error evaluating model_run {model_run_id} for eval {eval_id}: {e}"
        )
        # Mark as completed with error
        error_complete_params = InfrastructureEvalsMarkModelRunCompleteSqlParams(
            eval_id=uuid.UUID(eval_id),
            model_run_id=uuid.UUID(model_run_id),
        )
        await execute_sql_typed(
            conn, MARK_MODEL_RUN_COMPLETE_SQL_PATH, params=error_complete_params
        )
        # Emit error event
        if emit_progress_func:
            await emit_progress_func(
                {
                    "eval_id": eval_id,
                    "model_run_id": model_run_id,
                    "status": "error",
                    "message": f"Error: {str(e)}",
                }
            )
        raise


async def run_eval_parallel(
    eval_id: str,
    model_run_ids: list[str],
    rubric_id: str,
    conn: asyncpg.Connection,
    emit_progress_func: Any | None = None,
) -> None:
    """Run eval on multiple model_runs in parallel (max 4 concurrent).

    Args:
        eval_id: The eval ID
        model_run_ids: List of model_run IDs to evaluate
        rubric_id: The rubric ID to use for evaluation
        conn: Database connection (unused - each task acquires its own)
        emit_progress_func: Optional function to emit WebSocket progress events
    """
    # NOTE: Each task needs its own connection from the pool because
    # asyncpg connections cannot handle concurrent operations.
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    async def run_with_semaphore(model_run_id: str) -> None:
        async with _eval_semaphore:
            async with pool.acquire() as task_conn:
                await run_single_eval(
                    eval_id, model_run_id, rubric_id, task_conn, emit_progress_func
                )

    # Create tasks for all model_runs
    tasks = [run_with_semaphore(mr_id) for mr_id in model_run_ids]

    # Store tasks for cancellation
    task_key = f"{eval_id}"
    for i, task in enumerate(tasks):
        task_key_full = f"{eval_id}_{model_run_ids[i]}"
        _active_eval_tasks[task_key_full] = task

    try:
        # Run all tasks (semaphore limits to 4 concurrent)
        await asyncio.gather(*tasks)
    finally:
        # Clean up task tracking
        for mr_id in model_run_ids:
            task_key_full = f"{eval_id}_{mr_id}"
            _active_eval_tasks.pop(task_key_full, None)


def cancel_eval_tasks(eval_id: str) -> None:
    """Cancel all active tasks for an eval."""
    tasks_to_cancel = [
        task
        for key, task in _active_eval_tasks.items()
        if key.startswith(f"{eval_id}_")
    ]
    for task in tasks_to_cancel:
        if not task.done():
            task.cancel()
    # Clean up
    keys_to_remove = [
        key for key in _active_eval_tasks.keys() if key.startswith(f"{eval_id}_")
    ]
    for key in keys_to_remove:
        _active_eval_tasks.pop(key, None)

"""Eval run endpoint - v3 API following DHH principles."""

import asyncio
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, get_pool
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.evals.run_eval_worker import run_eval_parallel, cancel_eval_tasks
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class RunEvalRequest(BaseModel):
    """Request to run an eval."""

    evalId: str
    profileId: str


class RunEvalResponse(BaseModel):
    """Response from run eval."""

    success: bool
    evalId: str
    queued_count: int
    message: str


router = APIRouter()


async def _emit_eval_progress(event_data: dict[str, Any]) -> None:
    """Emit eval progress event via WebSocket."""
    # Import here to avoid circular dependency
    from app.socket.evals.run import eval_progress
    
    await eval_progress(
        {
            "eval_id": event_data.get("eval_id"),
            "run_id": event_data.get("run_id"),
            "status": event_data.get("status"),
            "message": event_data.get("message"),
            "grade_id": event_data.get("grade_id"),
        },
        room=f"eval_{event_data.get('eval_id')}",
    )


@router.post("/run", response_model=RunEvalResponse)
async def run_eval(
    request: RunEvalRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RunEvalResponse:
    """Run an eval on its pending model_runs."""
    tags = ["evals"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get eval and pending model_runs
        sql_query = load_sql("sql/v3/evals/run_eval.sql")
        sql_params = (request.evalId,)
        result = await conn.fetchrow(sql_query, request.evalId)

        if not result:
            raise ValueError(f"Eval not found: {request.evalId}")

        eval_id = result["eval_id"]
        rubric_id = result["rubric_id"]
        pending_model_run_ids = result.get("pending_run_ids") or []

        if not pending_model_run_ids:
            return RunEvalResponse(
                success=True,
                evalId=eval_id,
                queued_count=0,
                message="No pending model_runs to evaluate",
            )

        # Get database pool for background task
        pool = get_pool()
        if not pool:
            raise ValueError("Database pool not available")

        # Create background task to run eval
        async def run_eval_background() -> None:
            async with pool.acquire() as bg_conn:
                try:
                    await run_eval_parallel(
                        eval_id,
                        pending_model_run_ids,
                        rubric_id,
                        bg_conn,
                        _emit_eval_progress,
                    )
                except Exception as e:
                    # Log error but don't fail the request
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error running eval {eval_id}: {e}")

        # Queue background task
        task = asyncio.create_task(run_eval_background())

        result_data = RunEvalResponse(
            success=True,
            evalId=eval_id,
            queued_count=len(pending_model_run_ids),
            message=f"Queued {len(pending_model_run_ids)} model_runs for evaluation",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="run_eval",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


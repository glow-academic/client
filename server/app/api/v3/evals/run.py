"""Eval run endpoint - v3 API following DHH principles."""

import asyncio
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.infra.v3.evals.run_eval_worker import run_eval_parallel
from app.main import get_db, get_pool
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql


# Inline request/response schemas
class RunEvalRequest(BaseModel):
    """Request to run an eval."""

    evalId: str
    # profileId removed - comes from X-Profile-Id header


class RunEvalResponse(BaseModel):
    """Response from run eval."""

    success: bool
    evalId: str
    queued_count: int
    message: str


router = APIRouter()


async def _emit_eval_progress(event_data: dict[str, Any]) -> None:
    """Emit eval progress event via WebSocket."""
    # TODO: Create app.socket.v3.evals.run module with eval_progress function
    # For now, this is a no-op until the WebSocket handler is implemented
    pass


@router.post(
    "/run",
    response_model=RunEvalResponse,
    dependencies=[
        audit_activity("eval.run", "{{ actor.name }} ran eval '{{ eval.name }}'")
    ],
)
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
        profile_id = http_request.state.profile_id
        # Get eval and pending model_runs
        sql_query = load_sql("app/sql/v3/evals/run_eval.sql")
        sql_params = (request.evalId, profile_id)
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise ValueError(f"Eval not found: {request.evalId}")

        eval_id = result["eval_id"]
        eval_name = result["eval_name"]
        rubric_id = result["rubric_id"]
        pending_model_run_ids = result.get("pending_run_ids") or []
        actor_name = result.get("actor_name")
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                eval={"name": eval_name, "id": eval_id},
            )

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

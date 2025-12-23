"""Eval stop endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.infra.v3.evals.run_eval_worker import cancel_eval_tasks
from app.main import get_db, transaction
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql


# Inline request/response schemas
class StopEvalRequest(BaseModel):
    """Request to stop an eval."""

    evalId: str
    # profileId removed - comes from X-Profile-Id header


class StopEvalResponse(BaseModel):
    """Response from stop eval."""

    success: bool
    evalId: str
    stopped_count: int
    message: str


router = APIRouter()


@router.post(
    "/stop",
    response_model=StopEvalResponse,
    dependencies=[
        audit_activity(
            "eval.stopped", "{{ actor.name }} stopped eval '{{ eval.name }}'"
        )
    ],
)
async def stop_eval(
    request: StopEvalRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> StopEvalResponse:
    """Stop a running eval."""
    tags = ["evals"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        async with transaction(conn):
            # Check if eval exists
            eval_check = await conn.fetchrow(
                "SELECT id FROM evals WHERE id = $1",
                request.evalId,
            )
            if not eval_check:
                raise ValueError(f"Eval not found: {request.evalId}")

            # Cancel active tasks
            cancel_eval_tasks(request.evalId)

            # Mark pending runs as completed
            sql_query = load_sql("app/sql/v3/evals/stop_eval.sql")
            sql_params = (request.evalId, profile_id)
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError("Failed to stop eval")

            stopped_count = result["stopped_count"]
            eval_name = result["eval_name"]
            actor_name = result["actor_name"]
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    eval={"name": eval_name, "id": request.evalId},
                )

        result_data = StopEvalResponse(
            success=True,
            evalId=request.evalId,
            stopped_count=stopped_count,
            message=f"Stopped {stopped_count} model_run evaluations",
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
            operation="stop_eval",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

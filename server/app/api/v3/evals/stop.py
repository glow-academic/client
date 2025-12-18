"""Eval stop endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.evals.run_eval_worker import cancel_eval_tasks
from app.utils.sql_helper import load_sql


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


@router.post("/stop", response_model=StopEvalResponse)
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
            sql_query = load_sql("sql/v3/evals/stop_eval.sql")
            sql_params = (request.evalId,)
            result = await conn.fetchrow(sql_query, request.evalId)

            if not result:
                raise ValueError("Failed to stop eval")

            stopped_count = result["stopped_count"]

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

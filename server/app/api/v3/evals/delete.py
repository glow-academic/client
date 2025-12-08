"""Eval delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DeleteEvalRequest(BaseModel):
    """Request to delete an eval."""

    evalId: str
    profileId: str


class DeleteEvalResponse(BaseModel):
    """Response from delete eval."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteEvalResponse)
async def delete_eval(
    request: DeleteEvalRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteEvalResponse:
    """Delete an eval."""
    tags = ["evals"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Check if eval exists
            eval_check = await conn.fetchrow(
                "SELECT id, name FROM evals WHERE id = $1",
                request.evalId,
            )
            if not eval_check:
                raise ValueError(f"Eval not found: {request.evalId}")

            eval_name = eval_check["name"]

            # Delete eval (cascades via FK)
            sql_query = load_sql("sql/v3/evals/delete_eval.sql")
            sql_params = (request.evalId,)
            result = await conn.fetchrow(sql_query, request.evalId)

            if not result:
                raise ValueError("Failed to delete eval")

        result_data = DeleteEvalResponse(
            success=True,
            message=f"Eval '{eval_name}' deleted successfully",
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
            operation="delete_eval",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

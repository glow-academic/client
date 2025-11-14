"""Rubric delete endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class DeleteRubricRequest(BaseModel):
    """Request for deleting a rubric."""

    rubricId: str


class DeleteRubricResponse(BaseModel):
    """Response for deleting a rubric."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteRubricResponse)
async def delete_rubric(
    request: DeleteRubricRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteRubricResponse:
    """Delete a rubric."""
    tags = ["rubrics"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Delete rubric with existence and usage checks in a single SQL file
        sql_query = load_sql("sql/v3/rubrics/delete_rubric_complete.sql")
        sql_params = (request.rubricId,)
        result = await conn.fetchrow(sql_query, request.rubricId)

        if not result:
            # Rubric doesn't exist
            raise HTTPException(
                status_code=404, detail=f"Rubric {request.rubricId} not found"
            )

        # Check if rubric was deleted or is in use
        if not result["deleted"]:
            # Rubric exists but is in use
            usage_count = result["usage_count"]
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete rubric: in use by {usage_count} simulation(s)",
            )

        result_data = DeleteRubricResponse(
            success=True,
            message="Rubric deleted successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_rubric",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


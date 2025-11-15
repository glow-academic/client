"""Cohort delete endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class DeleteCohortRequest(BaseModel):
    """Request for deleting a cohort."""

    cohortId: str


class DeleteCohortResponse(BaseModel):
    """Response for deleting a cohort."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteCohortResponse)
async def delete_cohort(
    request: DeleteCohortRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteCohortResponse:
    """Delete a cohort."""
    tags = ["cohorts"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Delete cohort with usage check (single query)
        sql_query = load_sql("sql/v3/cohorts/delete_cohort_complete.sql")
        sql_params = (uuid.UUID(request.cohortId),)
        result = await conn.fetchrow(sql_query, uuid.UUID(request.cohortId))

        if result and result["usage_count"] > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete cohort: in use by {result['usage_count']} attempt(s)",
            )
        
        # Note: DELETE is idempotent - deleting non-existent entity is considered success

        result = DeleteCohortResponse(
            success=True,
            message="Cohort deleted successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


"""Cohort leave endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class LeaveCohortRequest(BaseModel):
    """Request for leaving a cohort."""

    cohortId: str
    profileId: str


class LeaveCohortResponse(BaseModel):
    """Response for leaving a cohort."""

    success: bool
    message: str


router = APIRouter()


@router.post("/leave", response_model=LeaveCohortResponse)
async def leave_cohort(
    request: LeaveCohortRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaveCohortResponse:
    """Remove profile from cohort (leave cohort)."""
    tags = ["cohorts"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        sql_query = load_sql("sql/v3/cohorts/leave_cohort.sql")
        sql_params = (uuid.UUID(request.cohortId), uuid.UUID(request.profileId))
        await conn.execute(sql_query, uuid.UUID(request.cohortId), uuid.UUID(request.profileId))

        result = LeaveCohortResponse(
            success=True,
            message="Successfully left cohort",
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
            operation="leave_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


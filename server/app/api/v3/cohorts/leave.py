"""Cohort leave endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db
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
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaveCohortResponse:
    """Remove profile from cohort (leave cohort)."""
    tags = ["cohorts"]  # From router tags
    
    try:
        sql = load_sql("sql/v3/cohorts/leave_cohort.sql")
        await conn.execute(sql, uuid.UUID(request.cohortId), uuid.UUID(request.profileId))

        result = LeaveCohortResponse(
            success=True,
            message="Successfully left cohort",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


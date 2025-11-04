"""Cohort remove profiles endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class RemoveProfilesFromCohortRequest(BaseModel):
    """Request for removing profiles from cohort."""

    cohortId: str
    profileIds: list[str]
    currentProfileId: str


class RemoveProfilesFromCohortResponse(BaseModel):
    """Response for removing profiles from cohort."""

    success: bool
    message: str


router = APIRouter()


@router.post("/remove-profiles", response_model=RemoveProfilesFromCohortResponse)
async def remove_profiles_from_cohort(
    request: RemoveProfilesFromCohortRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RemoveProfilesFromCohortResponse:
    """Remove profiles from cohort."""
    tags = ["cohorts"]  # From router tags
    
    try:
        sql = load_sql("sql/v3/cohorts/remove_cohort_profiles.sql")
        await conn.execute(
            sql,
            uuid.UUID(request.cohortId),
            [uuid.UUID(pid) for pid in request.profileIds],
        )

        result = RemoveProfilesFromCohortResponse(
            success=True,
            message=f"Removed {len(request.profileIds)} profile(s) from cohort",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


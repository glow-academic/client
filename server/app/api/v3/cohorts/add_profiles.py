"""Cohort add profiles endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class AddProfilesToCohortRequest(BaseModel):
    """Request for adding profiles to cohort."""

    cohortId: str
    profileIds: list[str]


class AddProfilesToCohortResponse(BaseModel):
    """Response for adding profiles to cohort."""

    success: bool
    message: str


router = APIRouter()


@router.post("/add-profiles", response_model=AddProfilesToCohortResponse)
async def add_profiles_to_cohort(
    request: AddProfilesToCohortRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AddProfilesToCohortResponse:
    """Add profiles to cohort."""
    tags = ["cohorts"]  # From router tags
    
    try:
        # Add all profiles to cohort
        sql = load_sql("sql/v3/cohorts/insert_cohort_profile.sql")
        for profile_id in request.profileIds:
            await conn.execute(
                sql, uuid.UUID(request.cohortId), uuid.UUID(profile_id)
            )

        result = AddProfilesToCohortResponse(
            success=True,
            message=f"Added {len(request.profileIds)} profile(s) to cohort",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


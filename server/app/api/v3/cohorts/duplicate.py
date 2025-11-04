"""Cohort duplicate endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.sql_helper import load_sql


class DuplicateCohortRequest(BaseModel):
    """Request for duplicating a cohort."""

    cohortId: str


class DuplicateCohortResponse(BaseModel):
    """Response for duplicating a cohort."""

    success: bool
    cohortId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateCohortResponse)
async def duplicate_cohort(
    request: DuplicateCohortRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateCohortResponse:
    """Duplicate a cohort with relationships."""
    try:
        async with transaction(conn):
            # Get original cohort data
            get_sql = load_sql("sql/v3/cohorts/get_cohort_for_duplicate.sql")
            result = await conn.fetchrow(get_sql, uuid.UUID(request.cohortId))

            if not result:
                raise HTTPException(status_code=404, detail="Cohort not found")

            # Insert duplicate cohort
            duplicate_sql = load_sql("sql/v3/cohorts/duplicate_cohort.sql")
            new_cohort = await conn.fetchrow(
                duplicate_sql, result["title"], result["description"]
            )

            if not new_cohort:
                raise HTTPException(status_code=500, detail="Failed to create duplicate cohort")

            new_cohort_id = str(new_cohort["id"])

            # Copy relationships
            copy_profiles_sql = load_sql("sql/v3/cohorts/copy_cohort_profiles.sql")
            await conn.execute(
                copy_profiles_sql, uuid.UUID(new_cohort_id), uuid.UUID(request.cohortId)
            )

            copy_simulations_sql = load_sql("sql/v3/cohorts/copy_cohort_simulations.sql")
            await conn.execute(
                copy_simulations_sql, uuid.UUID(new_cohort_id), uuid.UUID(request.cohortId)
            )

        return DuplicateCohortResponse(
            success=True,
            cohortId=new_cohort_id,
            message=f"Cohort '{result['title']}' duplicated successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


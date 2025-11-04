"""Cohort delete endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql


class DeleteCohortRequest(BaseModel):
    """Request for deleting a cohort."""

    cohortId: str


class DeleteCohortResponse(BaseModel):
    """Response for deleting a cohort."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete")
async def delete_cohort(
    request: DeleteCohortRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteCohortResponse:
    """Delete a cohort."""
    try:
        # Check usage
        usage_sql = load_sql("sql/v3/cohorts/check_cohort_usage.sql")
        usage_row = await conn.fetchrow(usage_sql, uuid.UUID(request.cohortId))

        if usage_row and usage_row["usage_count"] > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete cohort: in use by {usage_row['usage_count']} attempt(s)",
            )

        # Delete cohort
        sql = load_sql("sql/v3/cohorts/delete_cohort.sql")
        await conn.execute(sql, uuid.UUID(request.cohortId))

        return DeleteCohortResponse(
            success=True,
            message="Cohort deleted successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


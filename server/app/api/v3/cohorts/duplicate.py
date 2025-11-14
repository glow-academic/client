"""Cohort duplicate endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateCohortResponse:
    """Duplicate a cohort with relationships."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        async with transaction(conn):
            # Get original cohort data
            get_sql = load_sql("sql/v3/cohorts/get_cohort_for_duplicate.sql")
            result = await conn.fetchrow(get_sql, uuid.UUID(request.cohortId))

            if not result:
                raise HTTPException(status_code=404, detail="Cohort not found")

            # Insert duplicate cohort (track primary operation)
            sql_query = load_sql("sql/v3/cohorts/duplicate_cohort.sql")
            sql_params = (result["title"], result["description"])
            new_cohort = await conn.fetchrow(sql_query, result["title"], result["description"])

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

        result_response = DuplicateCohortResponse(
            success=True,
            cohortId=new_cohort_id,
            message=f"Cohort '{result['title']}' duplicated successfully",
        )
        
        # Invalidate cache after mutation
        tags = ["cohorts"]  # From router tags
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


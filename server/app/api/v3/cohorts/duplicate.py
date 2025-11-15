"""Cohort duplicate endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateCohortResponse:
    """Duplicate a cohort with relationships."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Single consolidated query: gets original, creates duplicate, and copies relationships
        sql_query = load_sql("sql/v3/cohorts/duplicate_cohort_complete.sql")
        sql_params = (request.cohortId,)

        async with transaction(conn):
            result = await conn.fetchrow(sql_query, uuid.UUID(request.cohortId))

            if not result or not result["id"]:
                raise HTTPException(status_code=404, detail="Cohort not found")

            new_cohort_id = str(result["id"])

        result_response = DuplicateCohortResponse(
            success=True,
            cohortId=new_cohort_id,
            message=f"Cohort '{result['original_title']}' duplicated successfully",
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

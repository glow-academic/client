"""Cohort remove profiles endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.error_handler import handle_route_error
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RemoveProfilesFromCohortResponse:
    """Remove profiles from cohort."""
    tags = ["cohorts"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        sql_query = load_sql("sql/v3/cohorts/remove_cohort_profiles.sql")
        sql_params = (
            uuid.UUID(request.cohortId),
            [uuid.UUID(pid) for pid in request.profileIds],
        )
        await conn.execute(
            sql_query,
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
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="remove_profiles_from_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


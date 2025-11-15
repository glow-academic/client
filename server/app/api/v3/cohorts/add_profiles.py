"""Cohort add profiles endpoint - v3 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.invalidate_tags import invalidate_tags
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AddProfilesToCohortResponse:
    """Add profiles to cohort."""
    tags = ["cohorts"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Add all profiles to cohort (track primary operation - first profile)
        sql_query = load_sql("sql/v3/cohorts/insert_cohort_profile.sql")
        if request.profileIds:
            sql_params = (uuid.UUID(request.cohortId), uuid.UUID(request.profileIds[0]))
        for profile_id in request.profileIds:
            await conn.execute(
                sql_query, uuid.UUID(request.cohortId), uuid.UUID(profile_id)
            )

        result = AddProfilesToCohortResponse(
            success=True,
            message=f"Added {len(request.profileIds)} profile(s) to cohort",
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
            operation="add_profiles_to_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

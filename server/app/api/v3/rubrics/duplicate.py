"""Rubric duplicate endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class DuplicateRubricRequest(BaseModel):
    """Request for duplicating a rubric."""

    rubricId: str
    # profileId removed - comes from X-Profile-Id header


class DuplicateRubricResponse(BaseModel):
    """Response for duplicating a rubric."""

    success: bool
    rubricId: str
    message: str


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateRubricResponse,
    dependencies=[
        audit_activity(
            "rubric.duplicated",
            "{{ actor.name }} duplicated rubric '{{ rubric.name }}'",
        )
    ],
)
async def duplicate_rubric(
    request: DuplicateRubricRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateRubricResponse:
    """Duplicate a rubric with entire hierarchy."""
    tags = ["rubrics"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Duplicate rubric with departments, standard groups, and standards in a single SQL file
        sql_query = load_sql("sql/v3/rubrics/duplicate_rubric_complete.sql")
        sql_params = (request.rubricId, profile_id)
        row = await conn.fetchrow(sql_query, request.rubricId, profile_id)

        if not row:
            raise HTTPException(status_code=404, detail="Rubric not found")

        rubric_id = row["rubric_id"]
        original_name = row["original_name"]
        actor_name = row["actor_name"]
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                rubric={"name": original_name, "id": rubric_id},
            )

        result = DuplicateRubricResponse(
            success=True,
            rubricId=rubric_id,
            message=f"Rubric '{original_name}' duplicated successfully",
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
            operation="duplicate_rubric",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

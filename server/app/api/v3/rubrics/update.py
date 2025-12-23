"""Rubric update endpoint - v3 API."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


class StandardItem(BaseModel):
    """Standard item for update."""

    name: str
    description: str | None = None
    points: int


class StandardGroupItem(BaseModel):
    """Standard group item for update."""

    name: str
    short_name: str | None = None
    description: str | None = None
    points: int
    passPoints: int
    position: int | None = None
    active: bool = True
    standards: list[StandardItem] = []


class UpdateRubricRequest(BaseModel):
    """Request for updating a rubric."""

    rubricId: str
    name: str
    description: str | None = None
    active: bool
    points: int
    passPoints: int
    department_ids: list[str] = []
    standard_groups: list[StandardGroupItem] = []
    rubric_agent_id: str | None = None
    # profileId removed - comes from X-Profile-Id header


class UpdateRubricResponse(BaseModel):
    """Response for updating a rubric."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateRubricResponse,
    dependencies=[
        audit_activity(
            "rubric.updated", "{{ actor.name }} updated rubric '{{ rubric.name }}'"
        )
    ],
)
async def update_rubric(
    request: UpdateRubricRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateRubricResponse:
    """Update an existing rubric (replaces entire hierarchy)."""
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

        # Convert standard groups to JSONB array for SQL
        standard_groups_json = json.dumps(
            [
                {
                    "name": group.name,
                    "short_name": group.short_name,
                    "description": group.description,
                    "points": group.points,
                    "passPoints": group.passPoints,
                    "position": group.position,
                    "active": group.active,
                    "standards": [
                        {
                            "name": standard.name,
                            "description": standard.description,
                            "points": standard.points,
                        }
                        for standard in group.standards
                    ],
                }
                for group in request.standard_groups
            ]
        )

        # Ensure department_ids is always an array (empty if None)
        department_ids = request.department_ids if request.department_ids else []

        # Update rubric with departments, standard groups, and standards in a single SQL file
        sql_query = load_sql("app/sql/v3/rubrics/update_rubric_complete.sql")
        sql_params = (
            request.rubricId,
            request.name,
            request.description,
            request.active,
            request.points,
            request.passPoints,
            department_ids,
            standard_groups_json,
            profile_id,
            request.rubric_agent_id,
        )
        row = await conn.fetchrow(sql_query, *sql_params)

        if not row:
            raise HTTPException(status_code=404, detail="Rubric not found")

        rubric_name = row["rubric_name"]
        actor_name = row["actor_name"]
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                rubric={"name": rubric_name, "id": request.rubricId},
            )

        result = UpdateRubricResponse(
            success=True,
            message="Rubric updated successfully",
        )

        # Invalidate cache after mutation (both list and individual rubric)
        all_tags = tags + [f"rubric:{request.rubricId}"]
        await invalidate_tags(all_tags)
        response.headers["X-Invalidate-Tags"] = ",".join(all_tags)

        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_rubric",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

"""Rubric create endpoint - v3 API."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql


class StandardItem(BaseModel):
    """Standard item for create."""

    name: str
    description: str | None = None
    points: int


class StandardGroupItem(BaseModel):
    """Standard group item for create."""

    name: str
    short_name: str | None = None
    description: str | None = None
    points: int
    passPoints: int
    standards: list[StandardItem] = []


class CreateRubricRequest(BaseModel):
    """Request for creating a rubric."""

    name: str
    description: str | None = None
    active: bool = True
    points: int
    passPoints: int
    department_ids: list[str] = []
    standard_groups: list[StandardGroupItem] = []


class CreateRubricResponse(BaseModel):
    """Response for creating a rubric."""

    success: bool
    rubricId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateRubricResponse)
async def create_rubric(
    request: CreateRubricRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateRubricResponse:
    """Create a new rubric with nested structure."""
    tags = ["rubrics"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Convert standard groups to JSONB array for SQL
        standard_groups_json = json.dumps([
            {
                "name": group.name,
                "short_name": group.short_name,
                "description": group.description,
                "points": group.points,
                "passPoints": group.passPoints,
                "standards": [
                    {
                        "name": standard.name,
                        "description": standard.description,
                        "points": standard.points,
                    }
                    for standard in group.standards
                ]
            }
            for group in request.standard_groups
        ])

        # Ensure department_ids is always an array (empty if None)
        department_ids = request.department_ids if request.department_ids else []

        # Create rubric with departments, standard groups, and standards in a single SQL file
        sql_query = load_sql("sql/v3/rubrics/create_rubric_complete.sql")
        sql_params = (
            request.name,
            request.description,
            request.active,
            request.points,
            request.passPoints,
            department_ids,
            standard_groups_json,
        )
        row = await conn.fetchrow(sql_query, *sql_params)

        if not row:
            raise HTTPException(status_code=500, detail="Failed to create rubric")

        rubric_id = row["rubric_id"]

        result = CreateRubricResponse(
            success=True,
            rubricId=rubric_id,
            message="Rubric created successfully",
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
            operation="create_rubric",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


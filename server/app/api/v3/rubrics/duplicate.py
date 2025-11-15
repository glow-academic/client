"""Rubric duplicate endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class DuplicateRubricRequest(BaseModel):
    """Request for duplicating a rubric."""

    rubricId: str


class DuplicateRubricResponse(BaseModel):
    """Response for duplicating a rubric."""

    success: bool
    rubricId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateRubricResponse)
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
        # Duplicate rubric with departments, standard groups, and standards in a single SQL file
        sql_query = load_sql("sql/v3/rubrics/duplicate_rubric_complete.sql")
        sql_params = (request.rubricId,)
        row = await conn.fetchrow(sql_query, request.rubricId)

        if not row:
            raise HTTPException(status_code=404, detail="Rubric not found")

        rubric_id = row["rubric_id"]

        # Get original rubric name for message
        original_rubric = await conn.fetchrow(
            "SELECT name FROM rubrics WHERE id = $1",
            request.rubricId,
        )
        original_name = original_rubric["name"] if original_rubric else "Rubric"

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

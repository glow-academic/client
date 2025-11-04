"""Rubric duplicate endpoint - v3 API."""

import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
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
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateRubricResponse:
    """Duplicate a rubric with entire hierarchy."""
    tags = ["rubrics"]  # From router tags
    
    try:
        async with transaction(conn):
            # Get original rubric data
            get_sql = load_sql("sql/v3/rubrics/get_rubric_for_duplicate.sql")
            rubric = await conn.fetchrow(get_sql, uuid.UUID(request.rubricId))

            if not rubric:
                raise HTTPException(status_code=404, detail="Rubric not found")

            # Create duplicate rubric
            duplicate_sql = load_sql("sql/v3/rubrics/duplicate_rubric.sql")
            new_rubric = await conn.fetchrow(
                duplicate_sql,
                rubric["name"],
                rubric["description"],
                rubric["points"],
                rubric["pass_points"],
            )

            if not new_rubric:
                raise HTTPException(status_code=500, detail="Failed to create duplicate rubric")

            new_rubric_id = str(new_rubric["id"])

            # Get original standard groups
            get_groups_sql = load_sql("sql/v3/rubrics/get_groups_for_duplicate.sql")
            groups = await conn.fetch(get_groups_sql, uuid.UUID(request.rubricId))

            # Duplicate groups and standards
            create_group_sql = load_sql("sql/v3/rubrics/create_standard_group.sql")
            create_standard_sql = load_sql("sql/v3/rubrics/create_standard.sql")
            get_standards_sql = load_sql("sql/v3/rubrics/get_standards_for_duplicate.sql")

            for group in groups:
                # Create new group
                new_group = await conn.fetchrow(
                    create_group_sql,
                    uuid.UUID(new_rubric_id),
                    group["name"],
                    group.get("short_name"),
                    group["description"],
                    group["points"],
                    group["pass_points"],
                )

                if not new_group:
                    raise HTTPException(status_code=500, detail="Failed to duplicate standard group")

                new_group_id = str(new_group["id"])

                # Get and duplicate standards for this group
                standards = await conn.fetch(get_standards_sql, group["id"])

                for standard in standards:
                    await conn.execute(
                        create_standard_sql,
                        uuid.UUID(new_group_id),
                        standard["name"],
                        standard["description"],
                        standard["points"],
                    )

        result = DuplicateRubricResponse(
            success=True,
            rubricId=new_rubric_id,
            message=f"Rubric '{rubric['name']}' duplicated successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


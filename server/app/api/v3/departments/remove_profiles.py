"""Department remove-profiles endpoint - v3 API."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


class RemoveProfilesFromDepartmentRequest(BaseModel):
    """Request for removing profiles from department."""

    departmentId: str
    profileIds: list[str]


class RemoveProfilesFromDepartmentResponse(BaseModel):
    """Response for removing profiles from department."""

    success: bool
    message: str


router = APIRouter()


@router.post("/remove-profiles", response_model=RemoveProfilesFromDepartmentResponse)
async def remove_profiles_from_department(
    request: RemoveProfilesFromDepartmentRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RemoveProfilesFromDepartmentResponse:
    """Remove profiles from department (set active = false in junction table)."""
    tags = ["departments"]  # From router tags
    
    try:
        # Get department title for message
        basic_sql = load_sql("sql/v3/departments/get_department_basic.sql")
        dept = await conn.fetchrow(basic_sql, request.departmentId)

        if not dept:
            raise HTTPException(status_code=404, detail=f"Department {request.departmentId} not found")

        async with transaction(conn):
            sql = load_sql("sql/v3/departments/remove_department_profiles.sql")
            await conn.execute(sql, request.departmentId, request.profileIds)

        result = RemoveProfilesFromDepartmentResponse(
            success=True,
            message=f"Removed {len(request.profileIds)} profile(s) from department '{dept['title']}' successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


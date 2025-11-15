"""Department remove-profiles endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RemoveProfilesFromDepartmentResponse:
    """Remove profiles from department (set active = false in junction table)."""
    tags = ["departments"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        async with transaction(conn):
            # Remove profiles (fetch department title and remove in single query)
            sql_query = load_sql("sql/v3/departments/remove_department_profiles_complete.sql")
            sql_params = (request.departmentId, request.profileIds)
            result_row = await conn.fetchrow(sql_query, request.departmentId, request.profileIds)

            if not result_row or not result_row.get("department_title"):
                raise HTTPException(status_code=404, detail=f"Department {request.departmentId} not found")

            department_title = result_row["department_title"]
            removed_count = result_row.get("removed_count", len(request.profileIds))

        result = RemoveProfilesFromDepartmentResponse(
            success=True,
            message=f"Removed {removed_count} profile(s) from department '{department_title}' successfully",
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
            operation="remove_profiles_from_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


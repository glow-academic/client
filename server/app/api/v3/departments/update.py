"""Department update endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


class UpdateDepartmentRequest(BaseModel):
    """Request for updating a department."""

    departmentId: str
    title: str
    description: str
    active: bool


class UpdateDepartmentResponse(BaseModel):
    """Response for updating a department."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateDepartmentResponse)
async def update_department(
    request: UpdateDepartmentRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateDepartmentResponse:
    """Update a department."""
    tags = ["departments"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        async with transaction(conn):
            sql_query = load_sql("sql/v3/departments/update_department.sql")
            sql_params = (request.departmentId, request.title, request.description, request.active)
            await conn.execute(sql_query, request.departmentId, request.title, request.description, request.active)

        result = UpdateDepartmentResponse(
            success=True,
            message="Department updated successfully",
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
            operation="update_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


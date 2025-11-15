"""Department duplicate endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


class DuplicateDepartmentRequest(BaseModel):
    """Request for duplicating a department."""

    departmentId: str


class DuplicateDepartmentResponse(BaseModel):
    """Response for duplicating a department."""

    success: bool
    departmentId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateDepartmentResponse)
async def duplicate_department(
    request: DuplicateDepartmentRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateDepartmentResponse:
    """Duplicate a department."""
    tags = ["departments"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Duplicate department (fetch and duplicate in single query)
            sql_query = load_sql("sql/v3/departments/duplicate_department_complete.sql")
            sql_params = (request.departmentId,)
            result = await conn.fetchrow(sql_query, request.departmentId)

            if not result or not result.get("new_department_id"):
                raise HTTPException(
                    status_code=404,
                    detail=f"Department {request.departmentId} not found",
                )

            new_department_id = result["new_department_id"]

        result = DuplicateDepartmentResponse(
            success=True,
            departmentId=new_department_id,
            message="Department duplicated successfully",
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
            operation="duplicate_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

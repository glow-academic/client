"""Department duplicate endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


class DuplicateDepartmentRequest(BaseModel):
    """Request for duplicating a department."""

    departmentId: str


class DuplicateDepartmentResponse(BaseModel):
    """Response for duplicating a department."""

    success: bool
    departmentId: str
    message: str


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateDepartmentResponse,
    dependencies=[
        audit_activity(
            "department.duplicated",
            "{{ actor.name }} duplicated department '{{ department.title }}'",
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with transaction(conn):
            # Duplicate department (fetch and duplicate in single query)
            sql_query = load_sql("app/sql/v3/departments/duplicate_department_complete.sql")
            sql_params = (request.departmentId, profile_id)
            result = await conn.fetchrow(sql_query, request.departmentId, profile_id)

            if not result or not result.get("new_department_id"):
                raise HTTPException(
                    status_code=404,
                    detail=f"Department {request.departmentId} not found",
                )

            new_department_id = result["new_department_id"]
            original_title = result.get("original_title", "Unknown")
            actor_name = result.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    department={"title": original_title, "id": request.departmentId},
                )

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

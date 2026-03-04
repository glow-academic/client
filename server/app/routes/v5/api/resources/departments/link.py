"""Link departments endpoint - records tool call tracking for non-creatable resources."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_db
from app.routes.v5.tools.resources.departments.link import (
    LinkDepartmentsSqlParams,
    link_departments_internal,
)
from app.utils.error.handle_route_error import handle_route_error


class LinkDepartmentsApiRequest(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID


class LinkDepartmentsApiResponse(BaseModel):
    success: bool = True
    department_id: UUID | None = None


router = APIRouter()


@router.post(
    "/departments/link",
    response_model=LinkDepartmentsApiResponse,
)
async def link_departments(
    request: LinkDepartmentsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LinkDepartmentsApiResponse:
    """Record tool call tracking for linking an existing department resource."""
    sql_params_tuple: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            params = LinkDepartmentsSqlParams(
                resource_id=request.resource_id,
                group_id=request.group_id,
                tool_id=request.tool_id,
            )
            sql_params_tuple = params.to_tuple()

            department_id = await link_departments_internal(
                conn,
                resource_id=request.resource_id,
                group_id=request.group_id,
                tool_id=request.tool_id,
            )

            return LinkDepartmentsApiResponse(
                success=True,
                department_id=department_id,
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="link_departments",
            sql_query=None,
            sql_params=sql_params_tuple,
            request=http_request,
        )

"""Link scenario_time_limits endpoint - records tool call tracking for selecting existing resources."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/link_scenario_time_limits_complete.sql"


class LinkScenarioTimeLimitsApiRequest(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID


class LinkScenarioTimeLimitsApiResponse(BaseModel):
    success: bool = True
    scenario_time_limits_id: UUID | None = None


class LinkScenarioTimeLimitsSqlParams(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID

    def to_tuple(self) -> tuple:
        return (self.resource_id, self.group_id, self.tool_id)


class LinkScenarioTimeLimitsSqlRow(BaseModel):
    scenario_time_limits_id: UUID | None = None


async def link_scenario_time_limits_internal(
    conn: asyncpg.Connection,
    resource_id: UUID,
    group_id: UUID,
    tool_id: UUID,
) -> UUID:
    """Record tool call tracking for linking an existing scenario_time_limits resource.

    Can be called directly from other routes (e.g. socket handlers, artifact saves)
    without HTTP overhead. Uses the same SQL as the HTTP endpoint.
    """
    params = LinkScenarioTimeLimitsSqlParams(
        resource_id=resource_id,
        group_id=group_id,
        tool_id=tool_id,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)
    result_row = LinkScenarioTimeLimitsSqlRow.model_validate(
        result.model_dump() if hasattr(result, "model_dump") else result
    )
    if not result_row.scenario_time_limits_id:
        raise ValueError(f"Failed to link scenario_time_limits: {resource_id}")
    return result_row.scenario_time_limits_id


router = APIRouter()


@router.post(
    "/scenario_time_limits/link",
    response_model=LinkScenarioTimeLimitsApiResponse,
)
async def link_scenario_time_limits(
    request: LinkScenarioTimeLimitsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LinkScenarioTimeLimitsApiResponse:
    """Record tool call tracking for linking an existing scenario_time_limits resource."""
    sql_params_tuple: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            params = LinkScenarioTimeLimitsSqlParams(
                resource_id=request.resource_id,
                group_id=request.group_id,
                tool_id=request.tool_id,
            )
            sql_params_tuple = params.to_tuple()

            scenario_time_limits_id = await link_scenario_time_limits_internal(
                conn,
                resource_id=request.resource_id,
                group_id=request.group_id,
                tool_id=request.tool_id,
            )

            return LinkScenarioTimeLimitsApiResponse(
                success=True, scenario_time_limits_id=scenario_time_limits_id
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="link_scenario_time_limits",
            sql_query=None,
            sql_params=sql_params_tuple,
            request=http_request,
        )

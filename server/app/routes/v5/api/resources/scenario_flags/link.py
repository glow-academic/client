"""Link scenario_flags endpoint - records tool call tracking for selecting existing resources."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/link_scenario_flags_complete.sql"


class LinkScenarioFlagsApiRequest(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID


class LinkScenarioFlagsApiResponse(BaseModel):
    success: bool = True
    scenario_flags_id: UUID | None = None


class LinkScenarioFlagsSqlParams(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID

    def to_tuple(self) -> tuple:
        return (self.resource_id, self.group_id, self.tool_id)


class LinkScenarioFlagsSqlRow(BaseModel):
    scenario_flags_id: UUID | None = None


async def link_scenario_flags_internal(
    conn: asyncpg.Connection,
    resource_id: UUID,
    group_id: UUID,
    tool_id: UUID,
) -> UUID:
    """Record tool call tracking for linking an existing scenario_flags resource.

    Can be called directly from other routes (e.g. socket handlers, artifact saves)
    without HTTP overhead. Uses the same SQL as the HTTP endpoint.
    """
    params = LinkScenarioFlagsSqlParams(
        resource_id=resource_id,
        group_id=group_id,
        tool_id=tool_id,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)
    result_row = LinkScenarioFlagsSqlRow.model_validate(
        result.model_dump() if hasattr(result, "model_dump") else result
    )
    if not result_row.scenario_flags_id:
        raise ValueError(f"Failed to link scenario_flags: {resource_id}")
    return result_row.scenario_flags_id


router = APIRouter()


@router.post(
    "/scenario_flags/link",
    response_model=LinkScenarioFlagsApiResponse,
)
async def link_scenario_flags(
    request: LinkScenarioFlagsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LinkScenarioFlagsApiResponse:
    """Record tool call tracking for linking an existing scenario_flags resource."""
    sql_params_tuple: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            params = LinkScenarioFlagsSqlParams(
                resource_id=request.resource_id,
                group_id=request.group_id,
                tool_id=request.tool_id,
            )
            sql_params_tuple = params.to_tuple()

            scenario_flags_id = await link_scenario_flags_internal(
                conn,
                resource_id=request.resource_id,
                group_id=request.group_id,
                tool_id=request.tool_id,
            )

            return LinkScenarioFlagsApiResponse(
                success=True, scenario_flags_id=scenario_flags_id
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="link_scenario_flags",
            sql_query=None,
            sql_params=sql_params_tuple,
            request=http_request,
        )

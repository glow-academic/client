"""Link simulation positions endpoint - records tool call tracking for selecting existing resources."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/link_simulation_positions_complete.sql"


class LinkSimulationPositionsApiRequest(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID


class LinkSimulationPositionsApiResponse(BaseModel):
    success: bool = True
    simulation_positions_id: UUID | None = None


class LinkSimulationPositionsSqlParams(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID

    def to_tuple(self) -> tuple:
        return (self.resource_id, self.group_id, self.tool_id)


class LinkSimulationPositionsSqlRow(BaseModel):
    simulation_positions_id: UUID | None = None


async def link_simulation_positions_internal(
    conn: asyncpg.Connection,
    resource_id: UUID,
    group_id: UUID,
    tool_id: UUID,
) -> UUID:
    """Record tool call tracking for linking an existing simulation position resource.

    Can be called directly from other routes (e.g. socket handlers, artifact saves)
    without HTTP overhead. Uses the same SQL as the HTTP endpoint.
    """
    params = LinkSimulationPositionsSqlParams(
        resource_id=resource_id,
        group_id=group_id,
        tool_id=tool_id,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)
    result_row = LinkSimulationPositionsSqlRow.model_validate(
        result.model_dump() if hasattr(result, "model_dump") else result
    )
    if not result_row.simulation_positions_id:
        raise ValueError(f"Failed to link simulation position: {resource_id}")
    return result_row.simulation_positions_id


router = APIRouter()


@router.post(
    "/simulation_positions/link",
    response_model=LinkSimulationPositionsApiResponse,
)
async def link_simulation_positions(
    request: LinkSimulationPositionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LinkSimulationPositionsApiResponse:
    """Record tool call tracking for linking an existing simulation position resource."""
    sql_params_tuple: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            params = LinkSimulationPositionsSqlParams(
                resource_id=request.resource_id,
                group_id=request.group_id,
                tool_id=request.tool_id,
            )
            sql_params_tuple = params.to_tuple()

            simulation_positions_id = await link_simulation_positions_internal(
                conn,
                resource_id=request.resource_id,
                group_id=request.group_id,
                tool_id=request.tool_id,
            )

            return LinkSimulationPositionsApiResponse(
                success=True, simulation_positions_id=simulation_positions_id
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="link_simulation_positions",
            sql_query=None,
            sql_params=sql_params_tuple,
            request=http_request,
        )

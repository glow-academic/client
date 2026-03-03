"""Link simulation positions endpoint - records tool call tracking for selecting existing resources."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_db
from app.routes.v5.tools.resources.simulation_positions.link import (
    LinkSimulationPositionsSqlParams,
    link_simulation_positions_internal,
)
from app.utils.error.handle_route_error import handle_route_error


class LinkSimulationPositionsApiRequest(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID

class LinkSimulationPositionsApiResponse(BaseModel):
    success: bool = True
    simulation_positions_id: UUID | None = None

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

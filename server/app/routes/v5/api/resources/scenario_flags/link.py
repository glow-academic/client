"""Link scenario_flags endpoint - records tool call tracking for selecting existing resources."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_db
from app.routes.v5.tools.resources.scenario_flags.link import (
    LinkScenarioFlagsSqlParams,
    link_scenario_flags_internal,
)
from app.utils.error.handle_route_error import handle_route_error


class LinkScenarioFlagsApiRequest(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID

class LinkScenarioFlagsApiResponse(BaseModel):
    success: bool = True
    scenario_flags_id: UUID | None = None

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

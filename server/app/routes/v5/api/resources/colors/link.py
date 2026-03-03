"""Link colors endpoint - records tool call tracking for selecting existing resources."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_db
from app.routes.v5.tools.resources.colors.link import (
    LinkColorsSqlParams,
    link_colors_internal,
)
from app.utils.error.handle_route_error import handle_route_error


class LinkColorsApiRequest(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID

class LinkColorsApiResponse(BaseModel):
    success: bool = True
    color_id: UUID | None = None

router = APIRouter()

@router.post(
    "/colors/link",
    response_model=LinkColorsApiResponse,
)
async def link_colors(
    request: LinkColorsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LinkColorsApiResponse:
    """Record tool call tracking for linking an existing color resource."""
    sql_params_tuple: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            params = LinkColorsSqlParams(
                resource_id=request.resource_id,
                group_id=request.group_id,
                tool_id=request.tool_id,
            )
            sql_params_tuple = params.to_tuple()

            color_id = await link_colors_internal(
                conn,
                resource_id=request.resource_id,
                group_id=request.group_id,
                tool_id=request.tool_id,
            )

            return LinkColorsApiResponse(success=True, color_id=color_id)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="link_colors",
            sql_query=None,
            sql_params=sql_params_tuple,
            request=http_request,
        )
